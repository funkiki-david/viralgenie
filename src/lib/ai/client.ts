import Anthropic from "@anthropic-ai/sdk";
import { getSystemPrompt } from "@/src/lib/ai/prompts";
import type { AnalysisType } from "@/src/types";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 6000;

export type AnalyzeResult =
  | { success: true; result: string }
  | { success: false; error: string };

export async function analyzeContent(
  markdown: string,
  analysisType: AnalysisType,
  locale: "en" | "zh" = "en",
): Promise<AnalyzeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { success: false, error: "ANTHROPIC_API_KEY is not configured" };
  }

  const client = new Anthropic({ apiKey });
  const languageName = locale === "zh" ? "Simplified Chinese" : "English";
  const systemPrompt = `${getSystemPrompt(analysisType)}

Output language: ${languageName}. Keep JSON keys exactly as specified, but write all user-facing string values in ${languageName}.`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: markdown }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    if (response.stop_reason === "max_tokens") {
      return {
        success: false,
        error: "Claude response was truncated before completion. Please try again or narrow the input URL.",
      };
    }

    if (!text) {
      return { success: false, error: "Claude returned no text content" };
    }

    return { success: true, result: text };
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return {
        success: false,
        error: `Anthropic API error ${err.status ?? ""}: ${err.message}`,
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
