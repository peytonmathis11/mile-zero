# MILE Ø · Version 0.3 — Runner-approved training intelligence

## What changed
- Reviews your last 14 **logged running sessions**, comparing planned and actual miles, missed workouts, fatigue, effort, and pain flags.
- Proposes conservative changes to up to 5 future **unlogged** workouts, and explains why.
- You can approve individual workouts or decline all. Manually edited workouts are unchecked by default.
- Approval / decline history appears on **Progress**, with undo of approvals where sessions have not changed since approval.
- Workout distances, paces, days, notes and schedules remain editable.
- Includes local storage and JSON / CSV export; no accounts or paid API required.

**This is rules-based training adaptation, not real AI.** It is not individualized medical advice. Pain flags trigger a conservative pause proposal; seek qualified advice where appropriate. AI model integration and longitudinal learning will require backend development and responsible data handling.

## Update your GitHub Pages site
1. Export a JSON backup from the current app first (Plan Settings → Download full backup).
2. Unzip this package and upload its **files** to the **root** of your public `mile-zero` GitHub repository (not the enclosing folder).
3. Confirm replacements, then commit. The service-worker cache version is updated for this release.
4. Open your GitHub Pages address and refresh; if old content persists, check in a private browser window.

### Saving data
This release keeps the existing `mile_zero_v2` localStorage key intentionally, so it should retain data on the same browser and origin. Always export a backup before updating. Data will **not** synchronize between phones, browsers, or devices.

### Testing checklist
- Create a plan and edit a future workout.
- Log a few completed/missed runs with effort and fatigue.
- Tap **Review training**; select individual proposed changes and approve them.
- Check **Progress → Training decisions**, undo an approval, and verify only unchanged, unlogged sessions are restored.
- Export and re-import a backup.

Long-term concept: secure profiles, weekly trends and smart coaching using an actual AI model, with users in charge of every suggested edit.
