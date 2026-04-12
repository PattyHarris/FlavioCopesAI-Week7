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
