# Starter Prompt

I have a working Recipe Finder app call Pantry Chef that uses AI to suggest recipes from ingredients. It currently uses a Supabase backend to store bookmarks and search history. There is no user accounts.

I want to turn it into a paid product.

## Changes for this project

Here's what I need, in this order:

1. UPDATE IMAGE GENERATION
   - dall-e-3 is being deprecated soon.
   - Replace usage of dall-e-3 with gpt-image-1-mini

2. AUTHENTICATION
   - Add magic link sign-in using Supabase Auth
   - Create a server-side client that reads auth from cookies
   - Add middleware that attaches the current user to every request
   - Add a "Sign in" button in the nav that opens a login modal
   - When an unauthenticated user tries to search for recipes, show the login modal instead
   - Show the user's email and a "Sign out" button when logged in

3. MOVE DATA TO SERVER
   - Create database tables for: bookmarks (per user), search_history (per user), recipe_cache (shared), recipe_images (shared)
   - Add user_id columns to bookmarks and search_history, with foreign keys to the auth users table
   - Enable Row Level Security so users can only access their own data - Supabase is currently setup with RLS.
   - Create API routes: GET/POST/DELETE /api/bookmarks, GET/POST /api/history, POST /api/history/clear
   - Replace all localStorage calls with fetch() to these API routes
   - Move image caching from filesystem to Supabase Storage

4. ADD PAYMENTS
   - Integrate a payment provide. I have added the Polar mcp server setup file in ~/.code/config.toml and have run the following command: codex mcp login polar_sandbox
   - Create a product with a monthly subscription price
   - Add a free tier: 3 recipe searches per account
   - Show a usage counter next to the search button: "2 of 3 free searches"
   - When the limit is reached, show an upgrade prompt with a checkout button
   - The checkout button creates a session and redirects to the payment provider's checkout page
   - After payment, redirect back to the app and refresh subscription status
   - Show a "Pro" badge in the nav for subscribers, and "Pro ∞" in the usage counter
   - Add subscription cancellation (set cancelAtPeriodEnd, don't cancel immediately)

Check subscription status by querying the payment provider's API directly (no webhooks needed for v1).

Keep the existing recipe search, bookmarks, and history features working. The app should feel the same to the user, just with accounts and a payment gate added on top.
