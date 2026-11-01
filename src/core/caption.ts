import { z } from "zod";
import { PLATFORMS } from "./schema.ts";

/** Caption generation helpers (pure: the server builds the prompt and parses the reply, the web shows the limits). */

export type Platform = (typeof PLATFORMS)[number];

/** Hard limit of caption + hashtags together (what the platform accepts); the UI warns above it. */
export const CAPTION_LIMIT: Record<Platform, number> = { instagram: 2200, linkedin: 3000, tiktok: 2200, facebook: 5000, x: 280, threads: 500, youtube: 5000, lainnya: 5000 };

/** What good looks like per platform; goes into the agent's system prompt. */
export const PLATFORM_RULES: Record<Platform, string> = {
  instagram: "The first line is the hook (under 125 characters: it is all people see before 'more'). Short paragraphs, one clear call to action at the end (save, share or comment). 5-10 hashtags.",
  linkedin: "Professional but human. The first two lines are the hook (about 200 characters). Short paragraphs separated by blank lines, no emoji walls, end with a question or a takeaway. Under 1300 characters. 3-5 hashtags.",
  tiktok: "Under 150 characters, punchy and curiosity-driven. 3-5 hashtags.",
  x: "At most 280 characters INCLUDING the hashtags. One or two sharp sentences. 0-2 hashtags.",
  threads: "Conversational, under 400 characters, end with a question. 0-3 hashtags.",
  facebook: "Friendly and conversational, under 500 characters, end with a question or a call to action. 0-3 hashtags.",
  youtube: "The first line is a title-like hook, then 2-3 sentences on what the viewer gets. Under 1000 characters. 3-5 hashtags.",
  lainnya: "General social caption: hook first, 2-4 short sentences, a call to action. 3-6 hashtags.",
};

export const CaptionRequest = z.object({
  platform: z.enum(PLATFORMS).default("instagram"),
  variants: z.number().int().min(1).max(3).default(3),
  /** Extra direction from the user (tone, angle, audience) */
  hint: z.string().trim().max(300).default(""),
});
export type CaptionRequest = z.infer<typeof CaptionRequest>;

export type CaptionVariant = { caption: string; hashtags: string };

/** "#a, b  #A" -> "#a #b": # prefix, letters/digits/_ only, no duplicates (case-insensitive), at most 30. */
export function normalizeTags(s: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of s.split(/[\s,]+/)) {
    const t = raw.replace(/[^\p{L}\p{N}_]/gu, "");
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(`#${t}`);
  }
  return out.slice(0, 30).join(" ");
}

const Reply = z.object({ variants: z.array(z.object({ caption: z.string().trim().min(1).max(5000), hashtags: z.string().max(2000).default("") })).min(1).max(3) });

/** The agent is told to answer with JSON only; models still wrap it in a code fence or a sentence now and then. Throws a readable error otherwise. */
export function parseVariants(reply: string): CaptionVariant[] {
  const m = /\{[\s\S]*\}/.exec(reply);
  if (!m) throw new Error("agent did not return captions");
  let json: unknown;
  try {
    json = JSON.parse(m[0]);
  } catch {
    throw new Error("agent returned malformed captions");
  }
  const r = Reply.safeParse(json);
  if (!r.success) throw new Error("agent returned captions in an unexpected shape");
  return r.data.variants.map((v) => ({ caption: v.caption, hashtags: normalizeTags(v.hashtags).slice(0, 1000) }));
}

/** Characters the platform counts: caption, blank line, hashtags. */
export const captionLength = (v: CaptionVariant) => v.caption.length + (v.hashtags ? 2 + v.hashtags.length : 0);
