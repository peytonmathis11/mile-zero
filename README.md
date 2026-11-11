# MILE Ø v0.8 — Trends & Weather (prototype)

## Before you upload
1. In your existing app, use **Plan Settings → Download all plans backup**. Keep the backup.
2. Unzip this ZIP. Upload `index.html`, `sw.js`, `icon.svg`, and `manifest.webmanifest` to the **root** of your existing GitHub repository, replacing matching files. Commit changes.
3. **Keep your existing `config.js` unchanged.** Do not upload your Supabase secret/service-role key. No additional SQL is required.
4. Refresh the site in a private window if caching causes a stale version.

## New features
- **Trends & Weather** tab: trends based on completed workouts, pace, average HR, effort and mileage, with a choice of active-plan or all-plans analysis.
- More cautious cross-plan duplicate handling: only exact same-day logged runs with matching distance, pace **and** HR are deduplicated in the all-plans view. Any others might double-count; check your logs.
- Optional **Use my location once** browser permission flow, or search a city instead. Coordinates are rounded to ~0.1 degree before weather request, are not saved or synced to Supabase, and are discarded when you close the tab. A weather provider does receive coordinates when you fetch local weather.
- Current temperature, feels-like temperature, humidity, wind, seven-day high/low temperatures, and rain probability from Open-Meteo.
- Weather caveats appear in **Review training** if you have recently requested a forecast. Weather does not automatically rewrite workouts.

## Important limitations
- This is **rule-based adaptation**, not a connected generative AI model. Training reviews still focus on the selected active plan rather than a truly combined workload. The all-plans display is analytics, not a consolidated training prescription.
- Weather is a forecast, not actual conditions from historical runs. Humidity and other measures alone cannot establish physiological risk or calculate individual safe pacing. The model does not diagnose injuries.
- Browser location permission requires HTTPS and an explicit click. Access can be denied. This version does not track runs via GPS or connect to Apple Health, Health Connect, Garmin or Strava.
- Open-Meteo's free API is for **non-commercial prototypes**; subscriptions or advertising would require commercial licensing, alternative licensed providers, and attribution compliance. See https://open-meteo.com/en/terms and https://open-meteo.com/en/docs.
- Need to independently test browser behavior, authentication, persistence and API availability before treating as production-ready.
