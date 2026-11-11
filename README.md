# MILE Ø v1.3 — Plan name sync fix

When regenerating an existing plan with an updated race goal, the My Plans name now follows the new distance (e.g., 50K training → 50 Mile training). Manually renamed plans stay customized. The existing plan ID, Supabase account configuration, and other saved plans are unchanged; regenerating still replaces that selected plan's workouts/logs as in v1.2.

## Install
Before regenerating, download an all-plans backup. Upload `index.html` and `sw.js` to your GitHub repository root, replacing the existing versions, then commit. Leave `config.js` unchanged. `icon.svg` and `manifest.webmanifest` are included for completeness but have not changed.

## Test
Create a throwaway plan for 50K, open Plan Settings, change the goal to 50 Mile, regenerate and confirm. My Plans should show `50 Mile training`. Rename a second test plan to `My Spring Ultra`, regenerate, and verify its custom name stays unchanged.

Note: This patch is built on v1.2; if you have made other manual code changes since then, apply the small source changes to your current index.html instead of replacing it wholesale.
