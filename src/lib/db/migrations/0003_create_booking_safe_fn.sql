-- create_booking_safe: the ONLY way app code should insert a row into
-- `bookings`. `drizzle-orm/neon-http` has no `db.transaction()` support (see
-- AGENTS.md hard constraints), so all concurrency-safe validation + insert
-- happens inside this single Postgres function call instead of a multi-query
-- JS transaction.
--
-- Locking strategy: pg_advisory_xact_lock keyed on (location_id, date) — not
-- per-slot — so every booking write for the same location+day serializes
-- against every other one for that same location+day. Day-level grain
-- avoids having to lock multiple slot_definitions rows in a nondeterministic
-- order (a common source of deadlocks); contention at that grain is low for
-- a single salon.
--
-- Returns a structured row (ok, error_code, booking) rather than raising an
-- exception on rejection — PLAN.md itself flags verifying `RAISE EXCEPTION`
-- message readability under the neon-http driver as an open spike, so a
-- structured return sidesteps that uncertainty entirely. Callers
-- (src/app/api/bookings+api.ts) map `error_code` to an HTTP status.
--
-- IMPORTANT: the 48h lead-time check below hardcodes 'Africa/Cairo' — this
-- MUST match BUSINESS_TIMEZONE in src/lib/time/business-time.ts. Postgres
-- can't import that TS constant, so these are two sources of truth for one
-- fact; edit both together if the business timezone ever changes.
CREATE OR REPLACE FUNCTION create_booking_safe(
  p_location_id    uuid,
  p_treatment_id   uuid,
  p_customer_id    uuid,
  p_customer_name  text,
  p_customer_phone text,
  p_date           date,
  p_start_time     time
) RETURNS TABLE (ok boolean, error_code text, booking jsonb)
LANGUAGE plpgsql AS $$
DECLARE
  v_duration_minutes int;
  v_end_time         time;
  v_is_open          boolean;
  v_open_time        time;
  v_close_time       time;
  v_override         date_overrides%ROWTYPE;
  v_dow               smallint;
  v_window            booking_windows%ROWTYPE;
  v_booking            bookings%ROWTYPE;
  v_full_slot_count     int;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_location_id::text || ':' || p_date::text, 0)
  );

  -- 1. Location must exist and be active.
  IF NOT EXISTS (SELECT 1 FROM locations WHERE id = p_location_id AND is_active) THEN
    RETURN QUERY SELECT false, 'LOCATION_INACTIVE'::text, NULL::jsonb; RETURN;
  END IF;

  -- 2. Treatment must exist, belong to this location, and be active.
  SELECT duration_minutes INTO v_duration_minutes
  FROM treatments
  WHERE id = p_treatment_id AND location_id = p_location_id AND is_active;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'TREATMENT_INACTIVE'::text, NULL::jsonb; RETURN;
  END IF;

  -- Guard against the booking rolling past midnight before computing end_time.
  IF (p_start_time - time '00:00:00') + make_interval(mins => v_duration_minutes) >= interval '24 hours' THEN
    RETURN QUERY SELECT false, 'INVALID_TIME_RANGE'::text, NULL::jsonb; RETURN;
  END IF;
  v_end_time := p_start_time + make_interval(mins => v_duration_minutes);

  -- 3. Date must fall within the location's open booking window.
  SELECT * INTO v_window FROM booking_windows WHERE location_id = p_location_id;
  IF NOT FOUND OR p_date < v_window.start_date OR p_date > v_window.end_date THEN
    RETURN QUERY SELECT false, 'OUTSIDE_BOOKING_WINDOW'::text, NULL::jsonb; RETURN;
  END IF;

  -- 4. 48h minimum lead time, evaluated in the fixed business timezone.
  IF (p_date + p_start_time) AT TIME ZONE 'Africa/Cairo' < now() + interval '48 hours' THEN
    RETURN QUERY SELECT false, 'LEAD_TIME_TOO_SHORT'::text, NULL::jsonb; RETURN;
  END IF;

  -- 5. Effective day rules: a date_overrides row always wins over the
  --    weekly schedule for that weekday.
  SELECT * INTO v_override FROM date_overrides WHERE location_id = p_location_id AND date = p_date;
  IF FOUND THEN
    v_is_open := v_override.is_open;
    v_open_time := v_override.open_time;
    v_close_time := v_override.close_time;
  ELSE
    v_dow := EXTRACT(DOW FROM p_date);
    SELECT is_open, open_time, close_time INTO v_is_open, v_open_time, v_close_time
    FROM weekly_schedules
    WHERE location_id = p_location_id AND day_of_week = v_dow;
    IF NOT FOUND THEN
      v_is_open := false;
    END IF;
  END IF;

  IF NOT v_is_open THEN
    RETURN QUERY SELECT false, 'DAY_CLOSED'::text, NULL::jsonb; RETURN;
  END IF;
  IF p_start_time < v_open_time OR v_end_time > v_close_time THEN
    RETURN QUERY SELECT false, 'OUTSIDE_BUSINESS_HOURS'::text, NULL::jsonb; RETURN;
  END IF;

  -- 6. The requested start time must be a real, active slot definition.
  IF NOT EXISTS (
    SELECT 1 FROM slot_definitions
    WHERE location_id = p_location_id AND start_time = p_start_time AND is_active
  ) THEN
    RETURN QUERY SELECT false, 'INVALID_SLOT'::text, NULL::jsonb; RETURN;
  END IF;

  -- 7. Capacity re-check: every active slot_definition instant covered by
  --    [p_start_time, v_end_time) must have remaining capacity — not just
  --    the exact start time. pending + confirmed bookings both count;
  --    cancelled bookings never do.
  SELECT count(*) INTO v_full_slot_count FROM (
    SELECT sd.id
    FROM slot_definitions sd
    LEFT JOIN bookings b
      ON b.location_id = sd.location_id
     AND b.date = p_date
     AND b.status IN ('pending', 'confirmed')
     AND b.start_time <= sd.start_time
     AND b.end_time > sd.start_time
    WHERE sd.location_id = p_location_id
      AND sd.is_active
      AND sd.start_time >= p_start_time
      AND sd.start_time < v_end_time
    GROUP BY sd.id, sd.capacity
    HAVING count(b.id) >= sd.capacity
  ) full_slots;

  IF v_full_slot_count > 0 THEN
    RETURN QUERY SELECT false, 'SLOT_FULL'::text, NULL::jsonb; RETURN;
  END IF;

  -- 8. All checks passed — insert as 'pending' (holds capacity immediately).
  INSERT INTO bookings (
    location_id, customer_id, treatment_id, status, date, start_time, end_time,
    customer_name, customer_phone
  ) VALUES (
    p_location_id, p_customer_id, p_treatment_id, 'pending', p_date, p_start_time, v_end_time,
    p_customer_name, p_customer_phone
  )
  RETURNING * INTO v_booking;

  RETURN QUERY SELECT true, NULL::text, to_jsonb(v_booking);
END;
$$;
