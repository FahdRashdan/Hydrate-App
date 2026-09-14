/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  // Only the availability engine has automated tests (AGENTS.md's testing
  // bar) — everything else is manual QA, so no app-wide test matching here.
  testMatch: ["**/*.test.ts"],
  // Metro resolves the `@/*` / `@/assets/*` aliases (tsconfig.json `paths`)
  // natively; Jest doesn't share Metro's resolver, so it needs its own
  // mapping to the same targets.
  moduleNameMapper: {
    "^@/assets/(.*)$": "<rootDir>/assets/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
