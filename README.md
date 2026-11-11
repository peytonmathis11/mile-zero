# Stride Ultra — v0.1

Free mobile-first progressive web app prototype. The plan generator and adaptations are **rule-based** and do not use a language model. This is a starting point for product testing, not a fully validated training prescription.

## Try it right now
Open `index.html` in a browser on a computer. Some browsers restrict local file storage or service workers for `file://` URLs; hosting via HTTPS is recommended for full PWA behavior.

## Host for free with GitHub Pages
1. Create a free GitHub account at https://github.com.
2. Create a new **public** repository, e.g. `stride-ultra`.
3. Select `Add file` -> `Upload files` and upload the four files in this folder (not the zip itself): `index.html`, `manifest.webmanifest`, `icon.svg`, `sw.js`.
4. Open the repository's **Settings** -> **Pages**. Under **Build and deployment**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, and **Save**.
5. Once GitHub publishes it, visit the URL provided in Pages settings on your phone. You can add the site to the home screen from your phone browser's share/menu controls.

GitHub Pages publishes the source repository publicly on its free tier. Do not upload secrets, API keys, or user data into the repository.

## What works
- 11 goal types including 50K, 50 mile, 100K, 100 mile, 6, 12 and 24 hours
- Set starting mileage, experience, training days, training horizon, terrain, preferred long-run day and focus
- Generate easy days, rest days, long runs, optional ultra back-to-backs, periodic recovery weeks, taper weeks
- Navigate every week; mark runs complete
- Adjust a week after missed workouts, fatigue or pain reports
- Save automatically in browser localStorage and export entire plan to CSV
- Offline access after hosting and initial service-worker cache (subject to browser storage settings)

## Limitations and next steps
- No actual AI model, cloud sync, accounts, wearable integrations, GPS, or push notifications.
- Personal data stays in local browser storage, which may be deleted by browser cleanup, private mode, or changing devices.
- The generator does not yet know longest recent run, history of injuries, pace/HR, vertical gain, race dates, race specificity, cross-training, real calendar dates, or performance results.
- Week totals are target approximations, not medical or coaching prescriptions; novice runners should use appropriate walk-run progressions instead of jumping to suggested run mileage.
- Very short timelines for ultras are flagged, but still generate a draft. These drafts do not establish race readiness.
- Before release to the public, add much stronger training safety guards, accessibility testing, product QA, and a privacy policy.
