# MILE Ø v1.1 — Race-Date Scheduling

New: choose **race date** and a Monday training start date. The app calculates weeks (4–52) and generates a calendar ending in the **race week**, with a race-day event on the correct weekday. The event is intentionally excluded from pre-race training mileage but can be logged afterward. Race countdown appears on the dashboard and calendar. The existing progressive training, accounts, and workout tracking remain.

## Install
Before replacing files, export your **full backup**. Upload `index.html`, `sw.js`, `manifest.webmanifest`, and `icon.svg` in the root of your existing GitHub repo, and commit. **Keep your configured `config.js`** and your Supabase settings. Make a new plan to test race-date functionality; saved plans are not automatically changed.

## Notes
Changing the race date of an existing plan and clicking Generate will **replace that plan's scheduled workouts and logged runs** after a confirmation. Back up first. This prototype uses rules-based training heuristics; weeks are calendar weeks (Monday–Sunday), including a potentially partial opening week and the race week. It does not verify race readiness or automatically realign multiple plans.
