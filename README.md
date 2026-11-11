# MILE Ø v0.9 — race-specific plan engine (prototype)

## Installation

1. In the current app, download a **full backup** of every plan before updating.
2. Unzip this package. Upload `index.html`, `sw.js`, `manifest.webmanifest`, and `icon.svg` to the ROOT of your GitHub Pages repository, replacing existing files.
3. **Keep your existing `config.js`.** Do not upload secrets or your database password; no new SQL is needed.
4. Commit, check GitHub Actions deployment, and reopen the app. If the old version persists, clear the website's cached data only after backing up.
5. In My Plans, choose **New plan** and fill in the assessment questions. Existing plans remain intact unless deliberately regenerated.

## What changed

* Goal-specific planning for first-mile, 5K, 10K, half, full, ultras, and timed ultras.
* New assessment: 30-day longest run, training consistency, race surface.
* Foundation, build, recovery, race-specific, and taper phases; different taper lengths by event.
* Controlled workouts for suitable runners; no automatic high-intensity training for beginners or runners returning after a break.
* Conservative long-run readiness bounds and explicit readiness warnings for ambitious targets.
* Preserves portfolios, runner profiles, workout logs, runner approval, Trends, and weather preferences from v0.8.1.

## Important limitations

This is a **rules-based planning prototype**, not a connected generative AI, medical advice, or a validated coaching product. It cannot guarantee race readiness or prevent injury. Weather does not yet dynamically change generated workouts; it adds optional context to training reviews. Multi-plan calendar is still a viewing tool, not a coordinated dual-race prescription. For beginner runners with no current mileage, numeric distance-based plans are especially crude and should be replaced with timed run/walk intervals in a later update.

Do not launch this commercially as a verified training coach without testing plans across runner profiles and obtaining qualified sports-science/endurance-coach review.
