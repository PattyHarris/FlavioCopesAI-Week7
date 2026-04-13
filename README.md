# Pantry Chef - Week 7

Pantry Chef is now an authenticated, paid recipe app built with `React`, `TypeScript`, `Vite`, `Express`, `Supabase Auth`, `Supabase Storage`, `OpenAI`, and `Polar`.

## What Changed From Week 5

- Added Supabase email OTP authentication.
- Moved bookmarks and search history to server-backed per-user APIs.
- Added shared Supabase-backed recipe caching and recipe image caching.
- Replaced image generation with `gpt-image-1-mini`.
- Added a free tier with `3` searches per account.
- Added Polar checkout, Pro status refresh, and cancel-at-period-end subscription management.

## Stack

- `React 18`
- `TypeScript`
- `Vite`
- `Tailwind CSS v4`
- `Express`
- `OpenAI gpt-4o-mini`
- `OpenAI gpt-image-1-mini`
- `Supabase Auth`
- `Supabase Postgres`
- `Supabase Storage`
- `Polar`

## Required Environment Variables

Server:

- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

Client:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Payments:

- `POLAR_ACCESS_TOKEN`
- `POLAR_PRODUCT_ID`
- `POLAR_SERVER` defaults to `sandbox`

The included `.env.example` has the full template.

## Supabase Setup

1. Run [`supabase/schema.sql`](/Users/pattyharris/Documents/FlavioCopesBootcamp/AIBootcamp/Week7/supabase/schema.sql:1) in the Supabase SQL editor.
2. In Supabase Auth, enable email OTP sign-in.
3. Set your site URL and redirect URL to your local app origin, for example `http://localhost:5173`.
4. Make sure the `recipe-images` storage bucket exists after running the SQL.
5. The project now works best with:
   - custom SMTP configured through Resend
   - `Confirm email` turned off for smoother passwordless OTP onboarding

## Polar Setup

The sandbox product for this project has already been created:

- Product: `Pantry Chef Pro`
- Product ID: `693d7306-a834-4781-8b8a-98a3953676f9`
- Price ID: `cd2ed0c2-eaaa-4ba1-b554-7623f3cb3ba0`
- Price: `$9/month`

Set `POLAR_PRODUCT_ID=693d7306-a834-4781-8b8a-98a3953676f9` in your local env when you want the app to use that sandbox product.

## Install And Run

```bash
npm install
npm run dev
```

Local URLs:

- Frontend: `http://localhost:5173`
- Backend health check: `http://127.0.0.1:8787/api/health`

## Main API Routes

- `GET /api/state`
- `POST /api/auth/session`
- `POST /api/auth/sign-out`
- `POST /api/recipes/suggest`
- `POST /api/recipes/image`
- `GET/POST/DELETE /api/bookmarks`
- `DELETE /api/bookmarks/:recipeId`
- `GET/POST /api/history`
- `POST /api/history/clear`
- `GET /api/subscription`
- `POST /api/checkout`
- `POST /api/subscription/cancel`

## Current Product Behavior

- Unauthenticated users are prompted to sign in before searching.
- If a signed-out user starts a search, that pending search is resumed automatically after OTP sign-in.
- Free users can run `3` recipe searches.
- The usage counter appears next to the search button.
- Pro users see a `Pro` badge in the nav and `Pro ∞` in the counter.
- Search history and bookmarks are tied to the signed-in user.
- Recipe suggestions are cached across users in Supabase.
- Generated recipe images are stored in Supabase Storage and reused.
- Subscription status is fetched directly from Polar without webhooks.
- Cancelling a subscription uses `cancelAtPeriodEnd`, so users keep Pro access until the current billing period ends.

## Testing

This project now includes Playwright smoke tests for the frontend shell and key auth/search entry points.

Expected commands:

```bash
npm run test:e2e
```

The Playwright tests are intentionally API-mocked so they can validate the app shell without requiring live Supabase, Polar, or OpenAI calls.

## Gotchas

- Supabase default email delivery is very rate-limited. Custom SMTP is strongly recommended for realistic testing.
- Resend requires a real domain or subdomain that you control in DNS.
- If `Confirm email` is enabled in Supabase, a brand-new email may receive a signup confirmation flow before OTP behaves like a one-step sign-in.
- Polar cancellation is not immediate in this app. A cancelled subscription remains Pro until the billing period ends.
- Shared recipe cache and recipe image metadata are stored server-side, so clearing a user account does not clear those shared caches.

## Future Enhancements

- Add richer Playwright coverage for OTP sign-in, free-tier exhaustion, and Pro upgrade flows with deterministic mocks.
- Add integration tests around server auth middleware and usage-limit enforcement.
- Replace direct Polar fetch calls with a small typed client wrapper plus better error surfacing.
- Add a subscription-management screen with clearer billing-period and renewal state.
- Add a seeded local/mock auth mode for classroom demos and offline testing.

## Build Verification

Verified locally with:

```bash
npm run build
```
