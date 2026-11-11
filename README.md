# MILE Ø v0.5 — Earthy design + Supabase accounts (beta)

This includes the forest green / khaki / stone grey / charcoal design. **MILE Ø** remains plain text inside the app; the mountain M is reserved for the eventual phone app icon.

## What is new
- Account tab with email signup, email login, and logout using Supabase Auth
- Individual cloud training records with database row-level security
- Progress, workouts, preferences and adjustment history saved together
- A guest plan stays separate from each user's plan
- Changes save locally first, then attempt to sync to the cloud when signed in
- Buttons to manually save, load, and copy a guest plan to an account
- Existing rules-based recommendations remain runner-approved; paid AI and billing are **not** implemented

## Setup (required for real accounts)
1. In Supabase: open **SQL Editor**, paste the contents of `setup.sql`, and run it.
2. Open **Project Settings > API Keys** (or **Connect**). Copy the **Project URL** and the public `sb_publishable_...` key (or legacy anon key). NEVER use a `service_role` / `sb_secret_` key.
3. Edit `config.js` to fill in `url` and `publishableKey` as strings in quotes. Public browser apps may contain this publishable key when row-level security is set up.
4. Supabase **Authentication > URL Configuration**: set the Site URL to `https://peytonmathis11.github.io/mile-zero/` and add `https://peytonmathis11.github.io/mile-zero/**` as a redirect URL.
5. In **Authentication > Providers > Email**, check the settings for confirmation emails. With confirmation enabled, users may need to verify their email before signing in. Supabase default emails have rate limits and are not production-ready.
6. Upload `index.html`, `sw.js`, `manifest.webmanifest`, `icon.svg`, and `config.js` to GitHub Pages repository root (NOT `setup.sql`, which need not be published). Commit changes.
7. Open the **Account** tab and sign up / sign in.

### Important notes
- Before updating, use **Plan Settings > Download full backup**.
- Cloud sync is beta, with simple last-write-wins behavior. Don't edit the same account on multiple devices at once.
- Existing anonymous local data can be explicitly copied to a signed-in account using the **Copy guest plan into account** button. It is NEVER automatically uploaded on signup.
- Never expose private server keys in GitHub. RLS is essential.
- There is no billing, payment collection or generative AI in this build. GitHub Pages is for prototyping, not commercial SaaS hosting.
