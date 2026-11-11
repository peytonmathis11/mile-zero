# MILE Ø v0.6 — Multiple training plans (beta)

- Save, switch, rename and delete multiple independent plans via **My Plans**.
- Each plan retains its own workout logs, paces, calendar, and adjustment history.
- Existing v0.5 single-plan local or cloud data is migrated to a one-plan portfolio.
- New cloud portfolios are stored in the **existing** Supabase `runner_data.payload` JSONB field. **No new SQL is needed.**
- The app still uses rules-based training suggestions, not generative AI.
- Simultaneous plans DO NOT coordinate training load. Do not stack two programs; select one active calendar.
- Backups now contain *all* plans. Old single-plan backup imports are supported.
- Basic cloud sync is last-write-wins. Avoid using two devices simultaneously.

## Before update
1. In v0.5, download a full backup of your current plan and keep it safe.
2. Unzip, upload `index.html`, `sw.js`, `manifest.webmanifest`, and `icon.svg` to the repository root. **Keep your existing configured `config.js` unchanged** (never replace it with a blank template).
3. No database setup or SQL rerun required.
4. Reload the app. Under My Plans, your existing plan should appear. Test a second plan and switching between them.
5. Check Account -> Save to cloud, then sign out and in to verify both plans appear.

This is a development prototype, not independently verified for production use. Test account sync before relying on it with important data. GitHub Pages should not host a paid subscription business.
