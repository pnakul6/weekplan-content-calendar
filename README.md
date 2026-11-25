# WeekPlan

A one-page AI content calendar maker. Enter a brand, pick a platform, goal and tone, and get a 7-day social media plan with post ideas, formats, opening lines and hashtags.

**Live demo:** add your Vercel link here

## How it works

- `index.html` is the page. It sends the form choices to `/api/ai` and shows the plan as a calendar.
- `api/ai.js` is a Vercel serverless function. It gives the AI a strategist role, asks for a structured JSON plan, and checks the result before sending it back.
- The Gemini API key is stored in the Vercel environment variable `GEMINI_API_KEY`, so it is never exposed in the browser.
- If one model is busy or out of free quota, the function tries the next one.
- Input length is limited and only approved platform, goal and tone options are accepted.

## Run it (free)

1. Get a free API key at https://aistudio.google.com.
2. Import this repo into Vercel.
3. Add `GEMINI_API_KEY` under Settings, then Environment Variables, and redeploy.

Built with AI, then reviewed and edited by hand.
