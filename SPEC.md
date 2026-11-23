PROJECT: "BreatheEasy" — PromptWars Challenge 06 entry.
Brief: "Build a GenAI-powered assistant that helps families and communities navigate urban air pollution, offering personalized low-emission daily routines, indoor air quality hacks, and sustainable swaps with clear impact explanations."

Final product (for context — build ONLY Phase 1 now):
A household air-quality planner for families in smoggy Indian cities. User enters city, plan day (today/tomorrow), household members and habits. App returns ONE household plan with two halves:
 (1) "Protect your family" — per-member best outdoor window, mask advice, indoor alternative, before/after exposure estimate;
 (2) "Cut your family's smog" — low-emission swaps, each tagged breatheLess and/or emitLess with an impact explanation.
Plus indoor ventilation advice and a shareable community advisory. Later phases: Gemini reasons over the household and returns structured JSON that our guardrails validate; "What if…" refine; English + Hindi UI with read-aloud; Cloud Run deploy.

The repo is graded by an AI on Code Quality, Security, Efficiency, Testing, Accessibility, Problem Statement Alignment, plus a manual review that checks every feature really works. No fake features, no placeholder buttons, no hardcoded demo output.

RULES FOR YOU
- Work only on the main branch. Never create branches.
- Keep the repo small (<10 MB). No build step.
- Do NOT invent citations. In data files, if you are not certain of a source, write "source": "NEEDS_SOURCE".
- Never call the data "real-time" or "street-level". It is a city-level model forecast (CAMS via Open-Meteo, ~25 km, 3-hourly).

STACK
Node.js 20+, Express, ES modules. zod (validation), helmet (strict CSP, no inline scripts), express-rate-limit, express.json({limit:'20kb'}). Tests: vitest + supertest + @vitest/coverage-v8. eslint + prettier (minimal). No database.

DATA SOURCES (no API keys)
- Geocoding: https://geocoding-api.open-meteo.com/v1/search?name=<city>&count=1&language=en (prefer country_code IN if multiple)
- Air quality: https://air-quality-api.open-meteo.com/v1/air-quality?latitude=..&longitude=..&hourly=pm2_5,pm10,us_aqi&timezone=auto&forecast_days=2

PHASE 1 — BUILD THIS NOW

1. Structure:
src/
  server.js (export app; listen only when run directly)
  config.js (env parsing with defaults: PORT, NODE_ENV, CACHE_TTL_MS)
  middleware/ (security headers, rate limit, error handler returning { error: { code, message } } — never leak stack traces)
  routes/health.js  GET /api/health
  routes/plan.js    POST /api/plan
  validation/schemas.js
  services/geocode.js, services/airQuality.js  (fetch with 8s AbortController timeout; in-memory TTL cache 30 min keyed by lat/lon rounded to 2 decimals; clear typed errors on upstream failure)
  rules/bands.js        PM2.5 µg/m³ -> band: Good 0–30, Satisfactory 31–60, Moderate 61–90, Poor 91–120, Very Poor 121–250, Severe >250. Label: "CPCB PM2.5 breakpoints applied to hourly forecast values (approximate)".
  rules/sensitivity.js  member type -> sensitivity: child (<12), teen, adult, elderly (60+), sensitive (e.g. asthma), outdoor-worker.
  rules/windows.js      find the lowest-mean-PM2.5 contiguous window of N hours between 06:00 and 21:00 on the plan day; also return the band of the member's usual time.
  rules/activities.js   outdoor exercise allowed? (adults up to Moderate, sensitive groups up to Satisfactory); indoor alternative; mask advice "consider a well-fitted N95" when band >= Poor.
  rules/commute.js      emission rank per passenger (approximate ordering): walk=0, cycle=0, metro=1, bus=1, e-rickshaw=2, auto=3, two-wheeler=3, car=4. Suggest ONLY options with rank <= current (time shift first, then mode). Never suggest a higher-emission mode. If user drives: suggest carpool + cabin air recirculation.
  rules/ventilation.js  no indoor sensor data exists: when band >= Poor, keep windows closed and air briefly 10–15 min at the cleanest forecast hour; avoid airing during cooking-smoke time conflicts. Mark as estimate.
  rules/exposure.js     RELATIVE estimate only: sum(PM2.5 × hours × inhalationMultiplier(activity) × microenvironmentFactor(indoor/outdoor)) for USUAL schedule vs RECOMMENDED schedule -> percentChange (rounded, returned with a low/high range using assumption ranges). No absolute health claims.
  rules/swaps.js        select swaps from data/swaps.json by household context + band.
  rules/guardrails.js   validatePlan(plan, context) -> { valid, violations[] }. Checks: no outdoor recommendation for sensitive members in Severe hours; no commute suggestion with higher emission rank than current; swap ids exist; exposure numbers present only with ranges; required disclaimer present. (Phase 2 will run Gemini output through this.)
  rules/advisory.js     community advisory text with ACTIONS (e.g. no leaf/garbage burning tonight, carpool for school run, best outdoor play window), not just warnings.
  rules/planBuilder.js  combines everything into the response below.
data/
  assumptions.json  inhalation multipliers by activity (rest, walk, cycle, exercise, play) and microenvironment factors (outdoor, indoor-windows-closed, indoor-windows-open, in-vehicle), each { value, low, high, unit, source }.
  swaps.json  10–12 items, e.g. exhaust/lid while cooking, wet mopping instead of dry sweeping, no incense or mosquito coils indoors, no leaf/garbage burning, carpool or public transport for school/office run, switch solid fuel to LPG/induction, keep a doormat and shoes outside, avoid idling the vehicle. Each: { id, title, condition, breatheLess: bool, emitLess: bool, impactLevel: low|medium|high, impactRange?: string, why, source }.

2. API contract
POST /api/plan body (validate strictly with zod, reject unknown keys):
{
  city: string 2–60 chars, letters/spaces/.-' only,
  planDay: "today" | "tomorrow",
  language: "en" | "hi",
  household: { cookingTimes: ["morning"|"midday"|"evening"] (0–3), cookingFuel: "lpg"|"induction"|"solid-fuel"|"mixed", hasExhaust: boolean, hasPurifier: boolean },
  members: 1–8 of { name: 1–30 chars letters/spaces only, type: enum above, usualOutdoorTime: "HH:MM", outdoorMinutes: 0–240, activity: "walk"|"cycle"|"exercise"|"play"|"errands"|"commute", commuteMode?: enum above }
}
Response:
{
  location: { name, country, lat, lon },
  forecastMeta: { source: "CAMS via Open-Meteo", resolutionNote, planDay, generatedAt },
  protect: { members: [{ name, type, sensitivity, riskTier, usual: { time, band, pm25 }, recommended: { window, band, pm25 }, actions: [], why: [], exposure: { percentChange, low, high, note } }] },
  indoor: { ventilation: { advice, bestAiringHour, why } },
  cut: { swaps: [{ id, title, breatheLess, emitLess, impactLevel, impactRange, why }] },
  community: { advisory },
  explanation: { text, source: "rules" },
  disclaimer: "Estimates from a city-level model forecast. Not medical advice."
}

3. Tests (tests/ mirrors src/; mock ALL network calls; no real HTTP in tests)
- One test file per rule module with named edge cases: band boundaries (30/31, 60/61, 90/91, 120/121, 250/251), empty or partial forecast, window at day edges, Severe + child, car commuter never gets a higher-emission suggestion, walker gets time-shift before mode change, exposure range always has low <= value <= high.
- guardrails: fixture plans that MUST fail (sensitive member outdoors in Severe hour, upgrade to car, unknown swap id, missing disclaimer) and one that passes.
- validation: rejects bad city strings, script tags in names, unknown keys, >8 members, bad HH:MM, oversized body.
- services: cache hit avoids second fetch, timeout -> typed error, geocode not found -> 404-style error.
- routes (supertest): /api/health 200; /api/plan success with mocked services; upstream failure -> clean JSON error, no stack trace; rate limit returns 429.
- Scripts: "test", "coverage", "lint", "start", "dev". Target >80% line coverage on src/.

4. Repo hygiene
- .gitignore includes .env, node_modules, coverage
- .env.example (PORT=3000, plus GEMINI_API_KEY= and GEMINI_MODEL= left empty for Phase 2)
- .github/workflows/ci.yml: on push to main, Node 20, npm ci, npm run lint, npm test
- LICENSE (MIT) already exists; keep README minimal for now (Phase 4 writes it)

WHEN DONE, STOP and show me:
(a) the file tree, (b) full output of `npm test` and `npm run coverage`, (c) one example curl to POST /api/plan and its real JSON response for city "Patna", (d) any item you marked NEEDS_SOURCE.
Do not start Phase 2.