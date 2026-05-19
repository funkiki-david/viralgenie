export interface GeneratedCoverImage {
  provider: "openai";
  model: "gpt-image-1";
  prompt: string;
  mimeType: string;
  dataUrl: string;
  createdAt: string;
  revisedPrompt?: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function generateCoverImage(prompt: string): Promise<GeneratedCoverImage> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
      quality: "low",
      output_format: "webp",
    }),
  });

  const payload = asRecord(await response.json().catch(() => ({})));
  if (!response.ok) {
    const error = asRecord(payload.error);
    throw new Error(
      typeof error.message === "string"
        ? error.message
        : `OpenAI image generation failed with HTTP ${response.status}`,
    );
  }

  const first = Array.isArray(payload.data) ? asRecord(payload.data[0]) : {};
  const b64 = typeof first.b64_json === "string" ? first.b64_json : "";
  if (!b64) {
    throw new Error("OpenAI image generation returned no image data");
  }

  return {
    provider: "openai",
    model: "gpt-image-1",
    prompt,
    mimeType: "image/webp",
    dataUrl: `data:image/webp;base64,${b64}`,
    createdAt: new Date().toISOString(),
    revisedPrompt:
      typeof first.revised_prompt === "string" ? first.revised_prompt : undefined,
  };
}
