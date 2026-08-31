// Direct Anthropic API blog-draft generation — replaces the Emergent LLM
// proxy (`emergentintegrations`). Port of
// backend/services/blog.py::generate_article_draft line-for-line: same
// system prompt, same JSON contract, same fallback parsing (strip code
// fences -> JSON.parse -> regex fallback -> required-field validation).
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT =
  "You are an SEO-savvy travel-finance editor at refundmysuper. refundmysuper is the trusted portal for former Australian residents from India, China and beyond claiming their DASP superannuation refund. " +
  "Write article drafts about Australian Super refunds (DASP) for backpackers, " +
  "working holiday makers and international students who have left Australia. " +
  "Always respond with ONLY a JSON object (no code fences, no prose) with keys: " +
  "title (max 90 chars, keyword-first), meta_description (140-160 chars), excerpt " +
  "(1-2 sentences), category, tags (array of 3-6 lowercase strings), keywords " +
  "(array of 3-8 SEO phrases), reading_time_minutes (int 3-8), content (markdown, " +
  "500-900 words, must use H2 sections, bullet lists, a table or blockquote, and " +
  "end with a call to action linking to '/#estimator').";

// Small, local slugify — intentionally NOT imported from blog.js to avoid a
// circular ESM import (blog.js's runAutopilotOnce imports
// generateArticleDraft from this module). blog.js owns the canonical
// `slugify` used elsewhere (e.g. re-slugifying on publish); this copy exists
// only so a freshly-generated draft always carries a slug.
function slugifyLocal(text) {
  const s = (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.slice(0, 140) || `post-${Math.random().toString(16).slice(2, 10)}`;
}

export async function generateArticleDraft(topic, keywords, category) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error("ANTHROPIC_API_KEY not configured");
    err.status = 503;
    throw err;
  }

  const client = new Anthropic({ apiKey });
  const userText =
    `Draft an SEO article for refundmysuper.\n\n` +
    `Topic: ${topic}\n` +
    `Target keywords: ${keywords && keywords.length ? keywords.join(", ") : "(pick from topic)"}\n` +
    `Preferred category: ${category || "auto-select from Guide, By Visa, By Country, Tips, Case Study"}\n\n` +
    "Respond with ONLY the JSON object.";

  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userText }],
  });

  let text = (response.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?/, "").trim();
    text = text.replace(/```$/, "").trim();
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      const err = new Error("LLM did not return JSON");
      err.status = 502;
      throw err;
    }
    data = JSON.parse(match[0]);
  }

  if (!data || !data.title || !data.meta_description || !data.excerpt || !data.content) {
    console.warn("LLM draft parse missing keys | payload=", data);
    const err = new Error("LLM draft missing required fields — try again");
    err.status = 502;
    throw err;
  }

  return {
    slug: slugifyLocal(data.title || topic),
    title: data.title,
    meta_description: data.meta_description,
    excerpt: data.excerpt,
    category: data.category || category || "Guide",
    tags: data.tags || [],
    keywords: data.keywords || keywords,
    reading_time_minutes: parseInt(data.reading_time_minutes ?? 5, 10),
    content: data.content,
    hero_image: null,
    author: "refundmysuper Team",
  };
}
