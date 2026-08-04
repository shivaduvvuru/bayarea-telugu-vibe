/**
 * AI monitoring for community posts. Every forum post is scored before it is
 * stored and sorted into one of two buckets:
 *   approve -> published immediately
 *   review  -> held in the editors' queue
 * The AI never rejects on its own; the worst it can do is ask a human.
 */

export type ModerationVerdict = {
  action: "approve" | "review";
  reason: string;
  labels: string[];
  /** 0 = clearly fine, 1 = clearly a problem. */
  score: number;
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

/** Cheap guardrails that run even when the AI service is unavailable. */
const HARD_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "contact-harvesting", re: /\b\d{3}[-. ]\d{3}[-. ]\d{4}\b/ },
  { label: "spam-link", re: /(bit\.ly|tinyurl|t\.me\/|wa\.me\/|telegram\.me)/i },
  { label: "financial-scam", re: /\b(crypto|forex|bitcoin|loan approval|work from home earn)\b/i },
  { label: "profanity", re: /\b(fuck|bitch|bastard|asshole)\w*\b/i },
  { label: "slur-or-caste", re: /\b(casteist|lower caste|dirty (muslim|hindu|christian))\b/i },
];

function heuristics(text: string): ModerationVerdict | null {
  const labels = HARD_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.label);
  const shouting = text.length > 40 && text === text.toUpperCase();
  if (shouting) labels.push("all-caps");
  if (labels.length === 0) return null;
  return {
    action: "review",
    reason: `Flagged by the automatic filter: ${labels.join(", ")}.`,
    labels,
    score: 0.8,
  };
}

const SYSTEM = `You moderate a Telugu community forum for the San Francisco Bay Area.
Readers are families, students, workers and small business owners.
Decide whether a post can go live immediately or must be read by a human editor first.

Send to review when the post contains, or plausibly contains: harassment, hate or
caste/religion/region-based abuse, threats, doxxing or personal contact details of
other people, adult content, illegal activity, immigration or legal advice presented
as fact, medical claims, financial or job scams, disguised advertising, repeated
link spam, or clearly false claims about a named person or organisation.
Ordinary opinion, complaints, criticism, political discussion, sales listings with a
normal price, and posts written in Telugu or Tinglish are fine — approve those.

Reply with JSON only:
{"action":"approve"|"review","reason":"one short sentence for the editor","labels":["kebab-case",...],"score":0.0-1.0}`;

/** Runs the AI monitor. Falls back to "review" when the service is unreachable. */
export async function moderate(input: {
  title?: string;
  body: string;
  category?: string;
}): Promise<ModerationVerdict> {
  const text = [input.title, input.body].filter(Boolean).join("\n\n").trim();
  const hard = heuristics(text);
  if (hard) return hard;

  const key = process.env["LOVABLE_API_KEY"];
  if (!key) {
    return {
      action: "review",
      reason: "AI monitoring is not configured, so this post is held for an editor.",
      labels: ["ai-unavailable"],
      score: 0.5,
    };
  }

  try {
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        model: MODEL,
        reasoning_effort: "none",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Category: ${input.category ?? "general"}\n\n${text.slice(0, 6000)}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`moderation gateway failed [${res.status}]: ${body}`);
      return {
        action: "review",
        reason:
          res.status === 429
            ? "AI monitor was rate limited; held for an editor."
            : "AI monitor could not score this post; held for an editor.",
        labels: ["ai-error"],
        score: 0.5,
      };
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Partial<ModerationVerdict>;
    const action = parsed.action === "approve" ? "approve" : "review";
    return {
      action,
      reason:
        typeof parsed.reason === "string" && parsed.reason.trim()
          ? parsed.reason.trim().slice(0, 300)
          : action === "approve"
            ? "Nothing of concern found."
            : "Held for editor review.",
      labels: Array.isArray(parsed.labels)
        ? parsed.labels.filter((l): l is string => typeof l === "string").slice(0, 6)
        : [],
      score: typeof parsed.score === "number" ? Math.min(1, Math.max(0, parsed.score)) : 0.5,
    };
  } catch (err) {
    console.error("moderation call failed", err);
    return {
      action: "review",
      reason: "AI monitor did not respond; held for an editor.",
      labels: ["ai-error"],
      score: 0.5,
    };
  }
}