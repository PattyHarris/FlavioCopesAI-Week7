# Build a Paid Product

This is an extension of Week5. See the file Notes-Week5.md in this folder for notes from that week.

There is a separate Supabase and Render project for this week as well.

As of May of 2026, Dall-e-3 is going to be deprecated. OpenAI suggests that you use gpt-image-1.5 or gpt-image-1-mini instead. I will need to have usage of Dall-e-3 replaced.

## Minimum Requirements

These are the features your app must have. Think of this as your checklist. If your app can do all of these things, you've completed the week. Everything beyond this list is extra.

- User authentication with sign-in and sign-out (magic link, OAuth, or email/password)
- Session persistence so users stay logged in across page loads and browser restarts
- Protected features that require login (e.g., recipe search shows a login prompt for unauthenticated users)
- Server-side data storage replacing localStorage, with each record tied to a user ID
- API routes that check authentication and only return data belonging to the current user
- A free tier with a usage limit (e.g., 3 free searches)
- A usage counter visible in the UI (e.g., "2 of 3 free searches")
- Payment provider integration with a checkout flow for subscribing
- An upgrade prompt that appears when the user hits the free tier limit
- A "Pro" indicator (badge, label, or similar) for paying subscribers
- Subscription cancellation support
- Tests that verify the app works correctly (UI tests, integration tests, or full end-to-end tests)

## Setting up the Polar Sandbox

You can use the sandbox here: https://sandbox.polar.sh (see online documentation). I used my github account as the login mechanism. The sandbox data is automatically removed after 90 days.

The Organization field in the setup is "Pantry Chef".

## Setting up the Polar MCP

There are separate instructions for the Polar MCP for production vs a sandbox. See their website for instructions geared towards using the Codex agent. The data is stored in the ~/.codex/config.toml file in this workspace.

NOTE: mcp server setup are NOT set in the workspace folder, e.g. Week5 or here, Week7. They are located under the user login folder, e.g. me. SO, the MCP file for Stitch, e.g. .vscode is located there as well as the .codex folder.

## Local Storage of Images

In Week 5, the images were stored in local storage. They disappear after a period of time. From the agent:

The images disappear because the app is saving temporary OpenAI image URLs, not permanent image files.

In server/openai.ts (line 53), generateRecipeImage() calls images.generate() and stores the returned url. Then src/App.tsx (line 290) writes that imageUrl back into the search group, and server/persistence.ts (line 113) persists that URL to Supabase. OpenAI’s image API docs say those URLs are only valid for about 60 minutes, so overnight they expire. That’s why the last search can still be there, but its images no longer load.

There’s a second, smaller reason too: server/openai.ts (line 22) uses an in-memory Map cache, so any backend restart also forgets cached image lookups. But the main overnight issue is the expiring URL.

## Vite reload line on the console

The Vite reload line is happening because initialPrompt.md is inside the Vite project root, and something is writing that file repeatedly.

Your vite.config.ts (line 5) does not exclude markdown files from watching, so when initialPrompt.md changes, Vite logs page reload initialPrompt.md. The app does not import that file, so this is not React doing it; it’s the file watcher noticing disk writes. The usual cause is editor autosave, markdown preview, sync tooling, or an extension repeatedly rewriting the file.

If you want, I can make a small change so Vite ignores initialPrompt.md or all \*.md files during dev.

## Remote vs Local environment setup

You still need .env.local for secrets and config that your app reads at runtime on your machine during local development.

Even if Supabase and Polar are remote services, your local frontend/backend still need to know:

which Supabase project to talk to
which keys to use
which Polar product/token to use
your OpenAI API key

In this project, .env.local is especially useful because:

the Express server reads OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY, POLAR_ACCESS_TOKEN, and POLAR_PRODUCT_ID

the Vite frontend reads VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY

So “remote” just means the services live elsewhere. Your local app still needs credentials and endpoints to reach them.

If you only deploy and never run locally, then your hosting platform’s environment settings can replace .env.local. But for npm run dev, you’ll want it.

## New Polar Sandbox

The Polar sandbox product is created as Pantry Chef Pro with product ID 693d7306-a834-4781-8b8a-98a3953676f9 and price ID cd2ed0c2-eaaa-4ba1-b554-7623f3cb3ba0.

POLAR_ACCESS_TOKEN is an Organization Access Token. In Polar, go to your organization’s dashboard, then Settings > General, scroll to Developers, and click New Token. Polar’s docs say OATs are created in organization settings and should be kept private: https://polar.sh/docs/integrate/oat

For sandbox, the base API URL is https://sandbox-api.polar.sh/v1. Polar also notes sandbox is fully isolated from production, so you need a separate sandbox token there.

## Cleanup Queries

1. Find the user

   select id, email, created_at
   from auth.users
   where email = 'your-test-email@example.com';

2. Reset the use's app data

   delete from bookmarks
   where user_id = (
   select id
   from auth.users
   where email = 'your-test-email@example.com'
   );

   delete from search_history
   where user_id = (
   select id
   from auth.users
   where email = 'your-test-email@example.com'
   );

3. If you also want to clear shared caches for a cleaner retest:

   delete from recipe_cache;
   delete from recipe_images;

4. And for the auth account itself, use the Supabase UI:

   Authentication > Users
   find your-test-email@example.com
   delete the user there
   That gives you a nearly full fresh-start test for that email.

## Auth UX Decision

For a realistic production-style experience, the preferred auth flow for Pantry Chef is:

- one email field
- one one-time code sent by email
- one OTP entry step in the same browser tab
- no password
- no redirect-based magic-link dependency

This is the smoothest passwordless UX and avoids the cross-browser problems that came up during testing when email links opened in Safari instead of the original Chrome session.

Important Supabase nuance:

- for an existing confirmed user, email OTP behaves like a true one-step sign-in flow
- for a brand new user, Supabase may treat the request as signup first, especially if email confirmation is enabled
- that can trigger a signup confirmation email instead of the expected OTP email

So the desired product UX is still "email + code = done", but Supabase's default new-user behavior can make first-time testing feel like a two-step signup-plus-OTP flow.

Going forward, the project direction should favor realistic UX over classroom-only convenience:

- keep the in-app OTP dialog
- avoid relying on magic-link redirects
- aim for seamless passwordless sign-in/signup behavior
- treat cross-browser link opening as something to avoid rather than depend on

## Seed User For Testing

For this project, the best local testing pattern is to keep one confirmed seed user in Supabase Auth and reuse it for OTP sign-in tests.

Do not insert a fake user directly into `auth.users` with SQL. Supabase Auth manages that table internally, and manual inserts there are not the normal or safe path.

Recommended approach:

1. Create a real test user with an email address you can access.
2. Confirm that user once through the normal Supabase email flow.
3. Keep that auth user in place for future OTP tests.
4. For retests, clear only app data like `bookmarks` and `search_history` instead of deleting the auth user.

Practical Supabase UI path:

- `Authentication > Users`
- create or invite the test user there if your project UI supports it
- or trigger the normal sign-up/sign-in flow once and confirm the email

This keeps the test flow aligned with the intended production UX while avoiding the repeated new-user signup confirmation path.

## Resend SMTP Setup For Supabase

For a more realistic passwordless auth flow, Supabase Auth emails can be sent through Resend SMTP instead of the default Supabase mail service.

Architecture:

- `Supabase` handles authentication
- `Resend` sends the auth emails over SMTP
- `Render` is only relevant for hosting the app, not for auth email delivery

Recommended setup:

1. Create a Resend account.
2. Add and verify a sending domain in Resend.
3. Create a Resend API key.
4. In Supabase, go to `Authentication > Email > SMTP Settings`.
5. Enable custom SMTP and use:

   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: `YOUR_RESEND_API_KEY`
   - Sender email: an address on the verified domain, for example `no-reply@auth.yourdomain.com`
   - Sender name: `Pantry Chef`

6. Save the settings and send a test email from Supabase.

For smoother local testing, it can help to turn off `Confirm email` in Supabase under the Email provider settings. That removes the extra signup-confirmation step and makes passwordless OTP behave more like a one-step sign-in flow.

Production note:

- Using Resend SMTP is realistic for production.
- Turning off `Confirm email` may be useful for classroom/testing scenarios, but should be considered carefully for a real production app.

### About Resend Domains

Resend requires a real domain or subdomain that you control in DNS.

That usually means:

- a domain purchased from a registrar such as GoDaddy, Namecheap, Cloudflare, or similar
- or a subdomain of a domain you already own

Why this matters:

- Resend verifies domain ownership by asking you to add DNS records
- if you cannot edit the domain's DNS records, you cannot verify it
- the sender email configured in Supabase must use that verified domain

Examples:

- `pantrychef.com`
- `auth.pantrychef.com`
- `yourname.dev`
- `mail.yourname.dev`

Not valid for this use:

- a made-up domain you do not own
- a Gmail address as the sending domain
- any domain where you do not have DNS control

## Final Wrap-Up

At this point, the project appears to be in good shape for the Week 7 goals:

- OTP authentication is working
- user-scoped bookmarks and history are working
- the free tier and Pro upgrade flow are working
- cancel-at-period-end subscription behavior is working
- recipe images are being stored in Supabase Storage
- Playwright smoke tests are in place

If this were moving beyond the class project, the next things worth considering would be:

1. Security and secrets

- rotate any API keys that were accidentally exposed during development
- make sure `.env.local` is excluded from git
- confirm production secrets are stored only in the deployment platform environment settings

2. Production polish

- add clearer user-facing error messages for auth failures, payment failures, and rate limits
- add a small account/settings area for subscription status and billing state
- consider whether `Confirm email = false` is acceptable for production or only for this learning project

3. Testing depth

- keep the Playwright smoke tests
- add deeper tests later for OTP, free-tier exhaustion, and checkout-state transitions
- consider adding server integration tests for auth middleware and usage enforcement

4. Operations

- verify Render environment variables match local `.env.local`
- verify Supabase redirect URLs and site URLs match the deployed app
- verify Resend sender domain and SMTP settings are documented somewhere safe outside the repo

5. Nice future enhancements

- add a user-facing subscription management page
- add analytics/logging for auth and payment issues
- add image cleanup or cache maintenance if the project grows
- add webhook support later if subscription state needs to be more real-time or more robust
