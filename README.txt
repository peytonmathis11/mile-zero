MILE Ø — Integrated Training + Saved City (BETA)

INSTALL
1. Back up your CURRENT working index.html and export your training plans.
2. Upload index.html and sw.js from this folder to the root of your GitHub repo, replacing only those files.
3. DO NOT replace config.js. Do not change your Supabase setup.
4. Commit to main, open your site, and hard-refresh.

WHAT THIS VERSION DOES
- Two active race plans maximum; unlimited saved plans.
- My Plans > Build integrated plan > Review > Approve. One selected session per day, original race plans retained.
- Approved integrated calendar has separate editing and run logging.
- Existing combined calendar remains.
- Profile > Weather and location preferences > Save a city/town. Saved city is stored in runnerProfile.trainingCity and syncs with your existing private Supabase payload. No precise latitude/longitude is saved. On a training review the app fetches current conditions from Open-Meteo when a saved city is present. Removing the saved city clears the profile field and syncs that change.
- Editing the other runner profile fields preserves the saved city.
- The integrated training preview is RULE-BASED, NOT a real OpenAI model. It does not independently optimize intensity, long-run progression, or race recovery and should be manually reviewed for safety and feasibility. It does not use long-range forecasts as daily workout prescriptions.

LIMITATIONS / SAFETY
- Test using a separate account with sample plans before trusting the schedule. This is not a validated coaching program.
- Never log the same workout both in a source plan and integrated plan.
- Rebuilding an approved integration can replace its logged workouts; export a backup FIRST.
- Supabase backups in its existing JSONB payload preserve the integrated schedule, active IDs, saved city.
- Open-Meteo free API is for non-commercial usage. Review licensing and data handling before a commercial launch.
- Saving a city requires an account. Exact GPS, street addresses and coordinates are not stored; the city string is cloud-synced and sent to the weather provider as part of geocoding queries when weather is requested. The weather provider receives approximate city coordinates for forecast requests.
- Future secured AI should consume consented weather snapshots and recent training; never expose API secrets in browser code or apply changes without approval.
