# MILE Ø v0.7 — Shared calendar & runner metrics (beta)

- **All Plans:** views all saved plans together, displaying workout source and overlapping days. Individual plans remain separate; **the app does not coordinate their training loads**.
- **Run logging:** optional actual average pace (mm:ss/mile) and average heart rate (bpm), saved per session. They appear in Progress and as context in rule-based training reviews.
- **Runner Profile:** optional age, weight in pounds, maximum HR, and resting HR. Example 5-zone estimates; measured max HR is preferred, age formula is only a rough estimate.
- **Calories:** approximate running energy from completed miles and entered weight: kcal ≈ weight_kg × miles × 1.609344. This is an estimate, not a measured calorimeter or watch readout.
- Existing Supabase `runner_data` stores a version-2 portfolio JSON object. Runner profile is appended as an optional object, so **no new SQL** is required. Cloud is last-write-wins.
- Wearable connections are **not implemented**. Apple Health requires an iOS app and HealthKit entitlement; Android Health Connect requires an Android app; Strava can be added later with secure OAuth and a backend. Never store third-party client secrets on GitHub Pages.
- Actual 'AI' is still a rules engine; recommendations remain runner-approved and are not medical guidance.

## Install

1. **Download your full backup** in the existing app.
2. Upload `index.html`, `sw.js`, `manifest.webmanifest`, and `icon.svg` to your GitHub repository root, replacing matching files. Keep your existing configured `config.js`; DO NOT upload a placeholder over it.
3. No database migration or SQL changes required.
4. Open the app, use All Plans, try a new workout log with pace and HR, and save Runner Profile.
5. Check Account > Save to cloud and test restoring both plans and the runner profile after signing in again.

Development prototype only, not production-tested, with no wearable access or generative AI connected. Health metrics should be collected only with clear user consent and strong privacy controls before public release.
