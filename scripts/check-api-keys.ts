import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import Anthropic from "@anthropic-ai/sdk";
import { Supadata } from "@supadata/js";
import { ApifyClient } from "apify-client";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", override: true });

type CheckStatus = "pass" | "fail" | "skip" | "warn";

interface CheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
}

interface SupadataProbe {
  name: string;
  url: string;
}

const args = new Set(process.argv.slice(2));
const live = args.has("--live");
const includePaid = args.has("--include-paid");

function mask(value: string | undefined): string {
  if (!value) return "(missing)";
  if (value.length <= 10) return `${value.slice(0, 2)}...`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function result(name: string, status: CheckStatus, detail: string): CheckResult {
  return { name, status, detail };
}

async function withTimeout<T>(
  ms: number,
  fn: () => Promise<T>,
): Promise<T> {
  return await Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms),
    ),
  ]);
}

async function checkDatabase(): Promise<CheckResult> {
  const url = env("DATABASE_URL");
  if (!url) return result("DATABASE_URL", "fail", "DATABASE_URL is not set");

  const prisma = new PrismaClient({ adapter: new PrismaPg(url) });
  try {
    await withTimeout(8000, () => prisma.$queryRaw`SELECT 1`);
    return result("DATABASE_URL", "pass", "Connected to PostgreSQL");
  } catch (err) {
    return result(
      "DATABASE_URL",
      "fail",
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

async function checkAnthropic(): Promise<CheckResult> {
  const key = env("ANTHROPIC_API_KEY");
  if (!key) return result("ANTHROPIC_API_KEY", "fail", "Not set");
  if (!live) {
    return result(
      "ANTHROPIC_API_KEY",
      "skip",
      `Set (${mask(key)}). Use --live to make a tiny Claude request.`,
    );
  }

  try {
    const client = new Anthropic({ apiKey: key });
    await withTimeout(15000, () =>
      client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8,
        messages: [{ role: "user", content: "Reply with ok." }],
      }),
    );
    return result("ANTHROPIC_API_KEY", "pass", "Claude request succeeded");
  } catch (err) {
    return result(
      "ANTHROPIC_API_KEY",
      "fail",
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function checkFirecrawl(): Promise<CheckResult> {
  const key = env("FIRECRAWL_API_KEY");
  if (!key) return result("FIRECRAWL_API_KEY", "fail", "Not set");
  if (!live) {
    return result(
      "FIRECRAWL_API_KEY",
      "skip",
      `Set (${mask(key)}). Use --live to scrape https://example.com.`,
    );
  }

  try {
    const response = await withTimeout(20000, () =>
      fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: "https://example.com",
          formats: ["markdown"],
          onlyMainContent: true,
        }),
      }),
    );
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 200) || response.statusText}`);
    }
    return result("FIRECRAWL_API_KEY", "pass", "Firecrawl scrape succeeded");
  } catch (err) {
    return result(
      "FIRECRAWL_API_KEY",
      "fail",
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function checkOpenAiImage(): Promise<CheckResult> {
  const key = env("OPENAI_API_KEY");
  if (!key) return result("OPENAI_API_KEY", "skip", "Not set");
  if (!live) {
    return result(
      "OPENAI_API_KEY",
      "skip",
      `Set (${mask(key)}). Use --live to generate a tiny image.`,
    );
  }

  try {
    const response = await withTimeout(30000, () =>
      fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt: "Minimal black circle on a white background",
          size: "1024x1024",
          quality: "low",
          output_format: "webp",
        }),
      }),
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = payload && typeof payload === "object" ? (payload as Record<string, unknown>).error : null;
      const message =
        error && typeof error === "object" && typeof (error as Record<string, unknown>).message === "string"
          ? (error as Record<string, unknown>).message
          : response.statusText;
      throw new Error(`HTTP ${response.status}: ${message}`);
    }
    return result("OPENAI_API_KEY", "pass", "OpenAI image generation succeeded");
  } catch (err) {
    return result(
      "OPENAI_API_KEY",
      "fail",
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function checkSupadata(): Promise<CheckResult> {
  const key = env("SUPADATA_API_KEY");
  if (!key) return result("SUPADATA_API_KEY", "fail", "Not set");
  if (!live) {
    return result(
      "SUPADATA_API_KEY",
      "skip",
      `Set (${mask(key)}). Use --live to fetch public video metadata.`,
    );
  }

  const probes: SupadataProbe[] = [
    {
      name: "youtube",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    },
    {
      name: "tiktok",
      url: "https://www.tiktok.com/@scout2015/video/6718335390845095173",
    },
  ];

  try {
    const client = new Supadata({ apiKey: key });
    const details: string[] = [];
    let youtubeHealthy = false;

    for (const probe of probes) {
      const startedAt = Date.now();
      try {
        await withTimeout(20000, () => client.metadata({ url: probe.url }));
        details.push(`${probe.name}: ok (${Date.now() - startedAt}ms)`);
        if (probe.name === "youtube") youtubeHealthy = true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const lower = message.toLowerCase();
        if (probe.name === "youtube") {
          return result("SUPADATA_API_KEY", "fail", `youtube probe failed: ${message}`);
        }
        if (
          lower.includes("limit exceeded") ||
          lower.includes("limit-exceeded") ||
          lower.includes("rate limit")
        ) {
          details.push(`${probe.name}: plan limit (${Date.now() - startedAt}ms)`);
          continue;
        }
        if (lower.includes("timed out")) {
          details.push(`${probe.name}: timeout (${Date.now() - startedAt}ms)`);
          continue;
        }
        details.push(`${probe.name}: error (${message})`);
      }
    }

    if (!youtubeHealthy) {
      return result(
        "SUPADATA_API_KEY",
        "fail",
        "youtube probe did not succeed",
      );
    }

    const degraded = details.some(
      (detail) =>
        detail.includes("plan limit") ||
        detail.includes("timeout") ||
        detail.includes("error"),
    );

    return result(
      "SUPADATA_API_KEY",
      degraded ? "warn" : "pass",
      details.join("; "),
    );
  } catch (err) {
    return result(
      "SUPADATA_API_KEY",
      "fail",
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function checkApify(): Promise<CheckResult> {
  const token = env("APIFY_API_TOKEN");
  if (!token) return result("APIFY_API_TOKEN", "fail", "Not set");

  try {
    const client = new ApifyClient({ token });
    const user = await withTimeout(12000, () => client.user().get());
    return result(
      "APIFY_API_TOKEN",
      "pass",
      `Authenticated as ${user?.username ?? user?.id ?? "Apify user"}`,
    );
  } catch (err) {
    return result(
      "APIFY_API_TOKEN",
      "fail",
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function checkTikHub(): Promise<CheckResult> {
  const key = env("TIKHUB_API_KEY");
  if (!key) return result("TIKHUB_API_KEY", "skip", "Not set");
  if (!live) {
    return result(
      "TIKHUB_API_KEY",
      "skip",
      `Set (${mask(key)}). Use --live to fetch TikHub account info.`,
    );
  }

  try {
    const res = await withTimeout(15000, () =>
      fetch("https://api.tikhub.io/api/v1/tikhub/user/get_user_info", {
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
      }),
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 200) || res.statusText}`);
    }
    return result("TIKHUB_API_KEY", "pass", "TikHub account info request succeeded");
  } catch (err) {
    return result(
      "TIKHUB_API_KEY",
      "fail",
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function checkRNote(): Promise<CheckResult> {
  const key = env("RNOTE_API_KEY");
  if (!key) return result("RNOTE_API_KEY", "skip", "Not set");
  if (!live || !includePaid) {
    return result(
      "RNOTE_API_KEY",
      "skip",
      `Set (${mask(key)}). Use --live --include-paid to make a small RNote API request.`,
    );
  }

  try {
    const res = await withTimeout(20000, () =>
      fetch(
        "https://rnote.dev/api/v2/crawler/search/users?keyword=ViralGenie",
        {
          headers: {
            "X-API-Key": key,
            Accept: "application/json",
          },
        },
      ),
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 200) || res.statusText}`);
    }
    return result("RNOTE_API_KEY", "pass", "RNote search users request succeeded");
  } catch (err) {
    return result(
      "RNOTE_API_KEY",
      "fail",
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function checkRunway(): Promise<CheckResult> {
  const key = env("RUNWAY_API_KEY");
  if (!key) return result("RUNWAY_API_KEY", "skip", "Not set");
  if (!live) {
    return result(
      "RUNWAY_API_KEY",
      "skip",
      `Set (${mask(key)}). Use --live to fetch account metadata.`,
    );
  }

  try {
    const res = await withTimeout(15000, () =>
      fetch("https://api.dev.runwayml.com/v1/organization", {
        headers: {
          Authorization: `Bearer ${key}`,
          "X-Runway-Version": "2024-11-06",
          Accept: "application/json",
        },
      }),
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 200) || res.statusText}`);
    }
    return result("RUNWAY_API_KEY", "pass", "Runway organization request succeeded");
  } catch (err) {
    return result(
      "RUNWAY_API_KEY",
      "fail",
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function checkAmazonScraperApi(): Promise<CheckResult> {
  const key = env("AMAZON_SCRAPER_API_KEY");
  if (!key) return result("AMAZON_SCRAPER_API_KEY", "skip", "Not set");
  if (!live || !includePaid) {
    return result(
      "AMAZON_SCRAPER_API_KEY",
      "skip",
      `Set (${mask(key)}). Use --live --include-paid to call the product endpoint.`,
    );
  }

  try {
    const res = await withTimeout(20000, () =>
      fetch("https://api.amazonscraperapi.com/products/B09B8V1LZ3?marketplace=US", {
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
      }),
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 200) || res.statusText}`);
    }
    return result("AMAZON_SCRAPER_API_KEY", "pass", "Product endpoint succeeded");
  } catch (err) {
    return result(
      "AMAZON_SCRAPER_API_KEY",
      "fail",
      err instanceof Error ? err.message : String(err),
    );
  }
}

function checkStaticEnv(): CheckResult[] {
  const checks: CheckResult[] = [];
  const secret = env("NEXTAUTH_SECRET");
  checks.push(
    secret
      ? result(
          "NEXTAUTH_SECRET",
          secret.length >= 32 ? "pass" : "warn",
          `Set (${secret.length} chars)`,
        )
      : result("NEXTAUTH_SECRET", "fail", "Not set"),
  );

  const nextAuthUrl = env("NEXTAUTH_URL");
  checks.push(
    nextAuthUrl
      ? result("NEXTAUTH_URL", "pass", nextAuthUrl)
      : result("NEXTAUTH_URL", "warn", "Not set; okay in local dev if same-origin login works"),
  );

  const amazonEngine = env("AMAZON_ENGINE") ?? "apify";
  checks.push(result("AMAZON_ENGINE", "pass", amazonEngine));
  return checks;
}

function icon(status: CheckStatus): string {
  if (status === "pass") return "PASS";
  if (status === "fail") return "FAIL";
  if (status === "warn") return "WARN";
  return "SKIP";
}

async function main() {
  const checks = await Promise.all([
    checkDatabase(),
    checkAnthropic(),
    checkFirecrawl(),
    checkOpenAiImage(),
    checkSupadata(),
    checkApify(),
    checkTikHub(),
    checkRNote(),
    checkRunway(),
    checkAmazonScraperApi(),
  ]);

  const rows = [...checkStaticEnv(), ...checks];
  const failed = rows.filter((row) => row.status === "fail");
  const warned = rows.filter((row) => row.status === "warn");

  console.log("\nViralGenie API key health check");
  console.log(`Mode: ${live ? "live remote checks" : "safe env checks"}`);
  if (live && !includePaid) {
    console.log("Paid/high-cost checks are skipped unless --include-paid is passed.");
  }
  console.log("");

  for (const row of rows) {
    console.log(`${icon(row.status).padEnd(4)}  ${row.name.padEnd(24)} ${row.detail}`);
  }

  console.log("");
  if (failed.length > 0) {
    console.log(`Result: ${failed.length} failed, ${warned.length} warnings`);
    process.exitCode = 1;
    return;
  }
  console.log(`Result: all required checks passed (${warned.length} warnings)`);
}

main().catch((err) => {
  console.error("API key check failed:", err);
  process.exit(1);
});
