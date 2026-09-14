// Display-only date/time formatting for the booking screens — deliberately
// separate from business-time.ts (which is business-rule math, unit-tested
// by the engine tests). No date library needed for a fixed no-DST timezone
// and this small a formatting surface.
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const FULL_MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function formatMonthYear(year: number, monthIndex: number): string {
  return `${FULL_MONTH_NAMES[monthIndex]} ${year}`;
}

/** "YYYY-MM-DD" -> "Mon, Jan 5" */
export function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAY_LABELS[dow]}, ${MONTH_LABELS[m - 1]} ${d}`;
}

/** "YYYY-MM-DD" -> "Mon" (for the date-picker pill row) */
export function weekdayAbbrev(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return WEEKDAY_LABELS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** "YYYY-MM-DD" -> "5" (for the date-picker pill row) */
export function dayNumber(dateStr: string): number {
  return Number(dateStr.split("-")[2]);
}

/** "HH:MM" or "HH:MM:SS" -> "2:00 PM" */
export function formatDisplayTime(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function formatDisplayDateTime(dateStr: string, timeStr: string): string {
  return `${formatDisplayDate(dateStr)} at ${formatDisplayTime(timeStr)}`;
}
