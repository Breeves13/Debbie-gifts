# Debbie’s Gifts

An iPhone-friendly gift tracker with keyboard dictation, a searchable gift list, stash reassignment, spending comparisons, and a printable Christmas list.

## Run locally

Use Node 22.12+, 24, or 26+. Copy `.env.example` to `.env.local` to enable the demo with fictional recipients. The dev server also defaults to demo mode when no Supabase URL is supplied. The demo saves in this browser’s local storage.

```sh
npm ci
npm run dev
npm test
npm run lint
npm run build
npm run preview
```

Build with `VITE_USE_MOCK=true` to preview the demo or host it as a static site. Deploy `dist/` over HTTPS. On iPhone, open the site in Safari and choose **Share → Add to Home Screen**. The production service worker caches the app shell. Live Supabase reads, writes, and sign-in need a network connection.

## Connect Supabase

Debbie’s Gifts uses the existing crew-scheduler Supabase project (`qlcwglfumiobmyhdoeyi`). Apply only [`20261126000001_gift_tracker_isolated_schema.sql`](supabase/migrations/20261126000001_gift_tracker_isolated_schema.sql). The `gifts` schema stays private and unexposed. The app uses allowlist-protected `public.gift_app_*` RPCs, and allowed accounts share the same tracker.

Set `VITE_USE_MOCK=false`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE_KEY`. A legacy `VITE_SUPABASE_ANON_KEY` also works. Rebuild after changing the Vite environment variables.

Keep crew-scheduler’s project-wide Site URL unchanged. In Redirect URLs, add only this app’s origin with `/**` appended. The app explicitly passes its own origin plus `/` for email sign-in and password recovery.

After the intended user’s first login, find their user ID in Supabase Auth. Insert that UUID, which is the value of their `auth.uid()`, into `gifts.app_users` using the SQL Editor. The user can reload the app once their account is on the allowlist.

```sql
insert into gifts.app_users (user_id)
values ('<intended-user-uuid>'::uuid)
on conflict (user_id) do nothing;
```

## Spending and exports

Each spending target applies to the selected occasion view. The group comparison flags a person when their spend differs from the average by at least $5 and at least 20% of that average. Group averages include people with zero spend.

The **Christmas PDF** and **Print** buttons in Gift List and Spending show all Christmas gifts, grouped by recipient, with all stash buckets combined at the end.
