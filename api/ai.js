// Vercel serverless function for the content calendar maker.
// The browser sends a brand, platform, goal and tone. This file asks the free Gemini API
// for a 7-day plan. The API key stays in a Vercel environment variable.

const PLATFORMS = ["Instagram", "LinkedIn", "X (Twitter)", "Facebook", "YouTube Shorts"];
const GOALS = ["Brand awareness", "More followers", "Sales", "Website traffic"];
const TONES = ["Friendly", "Professional", "Funny", "Inspiring"];

const SYSTEM = `You are an experienced social media strategist.
Create a 7-day content calendar for the brand, platform, goal and tone the user gives.
Return ONLY a JSON array of exactly 7 objects with these keys:
"day" (number 1 to 7),
"idea" (the post idea, max 20 words),
"format" (for example Reel, Carousel, Text post, Story, Poll, Short video),
"hook" (the opening line of the caption, max 15 words),
"hashtags" (array of 3 to 5 hashtags, each starting with #).
Vary the formats across the week and match the goal and tone. Do not add any other text.`;

// Models are tried in order. If one is busy (503), out of free quota (429) or retired (404),
// the next one is tried. Override with GEMINI_MODELS in Vercel (comma-separated).
const DEFAULT_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-3.8-flash"
];
const FROM_ENV = (process.env.GEMINI_MODELS || "").split(",").map(s => s.trim()).filter(Boolean);
const MODEL_LIST = FROM_ENV.length ? FROM_ENV : DEFAULT_MODELS;

async function callGemini(model, userText) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: { maxOutputTokens: 2048, responseMimeType: "application/json" }
      })
    }
  );
  let data = {};
  try { data = await r.json(); } catch (e) {}
  return { status: r.status, ok: r.ok, data };
}

function parsePlan(raw) {
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const arr = JSON.parse(clean);
    if (!Array.isArray(arr) || !arr.length) return null;
    return arr.slice(0, 7).map((d, i) => ({
      day: Number(d.day) || i + 1,
      idea: String(d.idea || ""),
      format: String(d.format || ""),
      hook: String(d.hook || ""),
      hashtags: Array.isArray(d.hashtags) ? d.hashtags.map(String).slice(0, 6) : []
    }));
  } catch (e) {
    return null;
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST." });
  }

  const { brand, platform, goal, tone } = req.body || {};
  if (typeof brand !== "string" || !brand.trim()) {
    return res.status(400).json({ error: "Please enter a brand or product." });
  }
  if (brand.length > 200) {
    return res.status(400).json({ error: "Brand description is too long (max 200 characters)." });
  }
  if (!PLATFORMS.includes(platform) || !GOALS.includes(goal) || !TONES.includes(tone)) {
    return res.status(400).json({ error: "Please choose a platform, goal and tone." });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "The server has no API key yet. Add GEMINI_API_KEY in Vercel settings." });
  }

  const userText = `Brand or product: ${brand.trim()}\nPlatform: ${platform}\nGoal: ${goal}\nTone: ${tone}`;

  try {
    let last;
    for (const model of MODEL_LIST) {
      last = await callGemini(model, userText);
      if (last.ok) {
        const parts = (last.data.candidates && last.data.candidates[0] && last.data.candidates[0].content && last.data.candidates[0].content.parts) || [];
        const raw = parts.map(p => p.text || "").join("").trim();
        const plan = parsePlan(raw);
        if (plan) return res.status(200).json({ plan });
        // The model answered but not in the right shape: try the next model.
        last = { status: 502, ok: false, data: {} };
        continue;
      }
      if (![503, 429, 404, 500].includes(last.status)) break;
    }

    if (last.status === 503 || last.status === 500) {
      return res.status(503).json({ error: "The free AI is very busy right now. Please wait a few seconds and press the button again." });
    }
    if (last.status === 429 || last.status === 404) {
      return res.status(429).json({ error: "The free AI quota is used up for now. Please try again in a minute." });
    }
    return res.status(502).json({ error: (last.data.error && last.data.error.message) || "The AI did not return a usable plan. Please try again." });
  } catch (e) {
    return res.status(500).json({ error: "Could not reach the AI service." });
  }
};
