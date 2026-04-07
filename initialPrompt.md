Build me an AI-powered recipe suggestion app. I type the ingredients I have, and it suggests recipes I can make with them.

Core features:

- An input where I add ingredients one at a time (as tags)
- A "Suggest Recipes" button that sends my ingredients to the server
- The server calls an AI language model (OpenAI GPT-4o-mini or similar) and asks for exactly 4 recipes
- The AI must return structured JSON (not free text) with: id, title, description, cookTime, difficulty, ingredients list, and instructions list
- Display recipes as cards with title, description, cook time, and difficulty badge
- Click a recipe card to see the full ingredient list and step-by-step instructions in a modal
- Bookmark recipes to save them (use localStorage)
- Cache AI responses so the same ingredient combination doesn't trigger another API call

The app should call the AI from server-side code only (never expose the API key in the browser). Store the API key in an environment variable.

Make it clean and usable. This is a cooking tool, not a demo.

Use the following instructions for the user interface:

## Stitch Instructions

Get the images and code for the following Stitch project's screens:

### Project

Title: Recipe Finder
ID: 10431470981106255521

### Screens:

1. Home - Pantry Finder (Accessible)
   ID: 29c55bbde8ab4b839b60f0804345b9c9

2. Recipe Detail (Accessible)
   ID: 6fa8c7e03a934ca78e118193b725150a

3. My Bookmarks (Accessible)
   ID: fbb4d0b38dea451ca93c14598a38ec95

Use a utility like `curl -L` to download the hosted URLs.

## Technical Stack

Use React and Typescript. Use DALL-E 3 for photograph generation and GPT-4o-mini recipe generation.

## Initial Testing

The frontend and backend will be initially tested locally.

### Data Format

The data returned for the recipe generation should be in JSON format.
