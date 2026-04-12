# AI Powered Application

## Using Stitch

This week we're building a recipe finder application. Flavio started using Stitch. Here's Flavio's initial request for Stitch: "Design a recipe app. I write a few ingredients, and then I click a "suggest recipes" button to get AI generated recipes. I can bookmark a recipe to save it".

I saw several videos on how to use Stitch, one also talks about creating a design system which occurred simply by including the color preference and "dark mode". With the design system in place, you can then more easily change the look and feel.

Idea for color palette: Sage Green, Soft White, Terracotta/Orange, Beige. Creates a trustworthy and healthy vibe

Idea for fonts: Playfair Display (Headings) + Roboto (Body)

I also had Stitch ensure the UI adhered to WAGA standards, pretty cool.

See this for how to setup the MCP server: https://stitch.withgoogle.com/docs/mcp/setup

Also the API key is setup in Stitch settings for the project.

# Stitch Instructions from the Export Process

## Stitch Instructions

Get the images and code for the following Stitch project's screens:

## Project

Title: Recipe Finder
ID: 10431470981106255521

## Screens:

1. Home - Pantry Finder (Accessible)
   ID: 29c55bbde8ab4b839b60f0804345b9c9

2. Recipe Detail (Accessible)
   ID: 6fa8c7e03a934ca78e118193b725150a

3. My Bookmarks (Accessible)
   ID: fbb4d0b38dea451ca93c14598a38ec95

Use a utility like `curl -L` to download the hosted URLs.

### Test Searches

Tomatoes, chickpeas,lemon
Chocolate, butter, flour, whipping cream, walnuts
Pasta, tuna

### Testing Delay

From AI: Yes, you can test this locally right now. Your current few-second search delay should be enough to notice the new behavior: text cards should appear first, with placeholders saying the image is being generated, and then the photos should populate afterward. If you want to exaggerate the effect, you can also use browser devtools network throttling, but you may not need it. npm run build still passes.

## Question on Render and Supabase vs Vercel

Yes. For this app, Render + Supabase is a very reasonable deployment choice, and probably the best fit if you want the fewest code changes from the current architecture.

My recommendation for Pantry Chef right now:

Supabase for database/auth/storage later, if you want persistent bookmarks, search history, user accounts, or saved recipes.
Render for the current Express backend, because your app already has a standalone Node server.
Either Render Static Site or Vercel for the frontend.
Why I’d lean Render + Supabase for this specific codebase:

Your backend is already an Express server, so Render can host it with minimal refactoring.
AI/image generation can take a few seconds, and a traditional Node service is a comfortable fit for that.
Supabase is strong if you later want persistent recipe history, bookmarks, auth, and storage.
This avoids reshaping your backend into a serverless/function-first layout unless you want to.

About Vercel:

Vercel is absolutely suitable too, especially for the frontend.
As of the current official pricing/docs I checked on March 28, 2026, Vercel still has a Hobby plan that is Free forever, and Pro starts at $20/month + additional usage. Source: https://vercel.com/pricing
Vercel Functions can work for AI workloads, and their docs explicitly mention AI/I/O-bound use cases. Source: https://vercel.com/docs/functions/
Current function duration docs show Hobby functions with fluid compute can run up to 300s (5 minutes). Source: https://vercel.com/docs/functions/configuring-functions/duration
The tradeoff with Vercel:

It’s best when your app is designed around Vercel’s deployment model.
Your current app is more naturally a frontend + Express API app than a Vercel-native app.
So Vercel is great, but it’s not automatically “better” unless you want its frontend workflow and are okay adapting backend deployment style.
Current pricing signals from official sources:

Render: Hobby plan $0/user/month plus compute costs; web services start at $0/month; Starter web service is $7/month. Source: https://render.com/pricing
Supabase: Free plus paid plans; billing docs currently show Pro/Team usage quotas such as 250 GB egress included, 8 GB DB included, 100 GB storage included, and 2 million Edge Function invocations included before overages. Source: https://supabase.com/docs/guides/platform/billing-on-supabase
Supabase Edge Functions overage: $2 per 1 million invocations. Source: https://supabase.com/docs/guides/functions/pricing
Vercel: Hobby free; Pro $20/month + additional usage. Source: https://vercel.com/pricing
Bottom line:

Best low-friction choice: Render + Supabase
Best frontend-first polished hosting option: Vercel frontend + Render backend + Supabase
Best only if you want to refactor more toward Vercel’s model: Vercel + Supabase

If you want, I can next give you a concrete deployment recommendation matrix for this project:

    - cheapest setup
    - easiest setup
    - best production-ready setup

## Local vs Remote

See Readme but in essence: So the switch is entirely env-based. There isn’t a separate command for “local backend vs Supabase” right now.

For record keeping, the quick rule is:

no Supabase env vars = local fallback mode
Supabase env vars present = local backend with Supabase persistence

## Notes for Discord

As others have done, I used Stitches to design the application but ran into a few communication issues with the Agent when trying to get the Agent to use the Stitches design directly. In fact, one of the TODO's mentioned by the Agent for improvement was to use the Stitches design directly. Funny. I like using VSCode and again used GPT-5.4.

Stack:

- React 18
- TypeScript
- Vite
- Tailwind CSS v4
- Express
- OpenAI GPT-4o-mini
- DALL-E 3

Remote Deployment:

- Render
- Supabase

The application performs all of the basic features.

## Debugging

One issue that took several tries was a problem where a bookmarked item's image was replaced by the last search result viewed. Last change:

I tightened the recipe identity logic again in src/lib/recipeIdentity.ts.

Before, the app was deriving its internal id from only:

title
cook time
ingredients
That still allowed collisions for recipes that looked broadly similar.

Now the internal id is based on a hashed fingerprint of the full recipe content:

title
description
cook time
difficulty
ingredients
instructions
That should make cross-search image bleed much less likely, and in practice it should eliminate the case you described unless two recipes are effectively identical.

npm run build still passes.

For the next test, I’d use exactly the same sequence as before. If it still happens after this change, then yes, the next useful debugging step would be for me to add a temporary on-screen/debug-console print of:

bookmark recipe id
current search recipe id
image update target id
But I’d try this stronger fix first.

### More Debugging

That last change didn't fix it:

don’t think stale database rows are the main issue here.

I changed the behavior so search-result image updates no longer modify bookmarks at all. Instead:

search rows manage their own image loading
bookmarks manage their own image loading when you save them
later searches should no longer be able to overwrite a saved bookmark’s image
The key change is in src/App.tsx:

removed bookmark updates from updateRecipeImageInGroups()
added a dedicated loadBookmarkImage() path for newly bookmarked recipes
npm run build passes.

So for your next test:

clear bookmarks
clear search history
bookmark a recipe
run another search
open a different result
go back to bookmarks
If it still happens after this change, then yes, the next step should be active debugging. At that point I’d add temporary logging showing:

bookmark id/title/imageUrl
opened search result id/title/imageUrl
every image update target
whether the update path is search group or bookmark
But this fix is a cleaner architectural separation, so I’d test this first.

This last change fixed the issue.

## Show Duplicate Results

Asked the Agent about that problem and it suggested that it make a change:

Now when you run the exact same ingredient search again:

the existing search row is moved to the top
it gets briefly highlighted
the page scrolls back to that row
no duplicate row is created
