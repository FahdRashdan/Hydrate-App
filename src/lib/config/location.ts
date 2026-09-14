// v1 seeds exactly one location (data model is location-scoped for future
// multi-location support — see PLAN.md — but nothing reads more than one
// location yet). Every API route, the availability engine, and
// scripts/seed.ts import this fixed id instead of querying "the one
// location" over and over.
export const DEFAULT_LOCATION_ID = "11111111-1111-1111-1111-111111111111";
