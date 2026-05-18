import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", override: true });

interface SessionUser {
  id: string;
  email: string;
  locale?: string;
  role?: string;
}

interface SessionResponse {
  user?: SessionUser;
  expires?: string;
}

interface AnalyzeTaskResponse {
  task?: {
    id: string;
    status: string;
    url: string;
    urlType: string;
    crawlEngine: string | null;
    promptType: string | null;
  };
}

interface TaskStatusResponse {
  task?: {
    id: string;
    status: string;
    errorMsg?: string | null;
    report?: Record<string, unknown> | null;
    crawlEngine?: string | null;
    urlType?: string;
  };
  status?: string;
  errorMsg?: string | null;
}

const args = new Map(
  process.argv.slice(2).map((entry) => {
    const [key, ...rest] = entry.split("=");
    return [key, rest.join("=")];
  }),
);

const baseUrl = (args.get("--base-url") || process.env.SMOKE_BASE_URL || "https://viralgenie.app").replace(/\/$/, "");
const email = args.get("--email") || process.env.SMOKE_EMAIL || "admin@viralgenie.app";
const password = args.get("--password") || process.env.SMOKE_PASSWORD || "admin123";
const locale = (args.get("--locale") || "en") as "en" | "zh";
const url = args.get("--url") || "https://openai.com";
const endpoint = args.get("--endpoint") || "connections";
const pollLimit = Number(args.get("--poll-limit") || "45");

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function main() {
  const cookieJar = new Map<string, string>();
  const headers: HeadersInit = {};

  function updateCookieJar(response: Response) {
    const raw = response.headers.get("set-cookie");
    if (!raw) return;
    const cookieParts = raw.split(/,(?=\s*[^;]+=)/);
    for (const part of cookieParts) {
      const pair = part.split(";")[0];
      const eqIndex = pair.indexOf("=");
      if (eqIndex <= 0) continue;
      cookieJar.set(pair.slice(0, eqIndex), pair.slice(eqIndex + 1));
    }
  }

  function withCookies(extra: HeadersInit = {}) {
    const cookie = Array.from(cookieJar.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    return {
      ...extra,
      ...(cookie ? { cookie } : {}),
    };
  }

  const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
  updateCookieJar(csrfRes);
  const { csrfToken } = await parseJson<{ csrfToken: string }>(csrfRes);

  const form = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: `${baseUrl}/`,
    json: "true",
  });

  const signInRes = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    headers: withCookies({
      "Content-Type": "application/x-www-form-urlencoded",
    }),
    body: form.toString(),
    redirect: "manual",
  });
  updateCookieJar(signInRes);

  const sessionRes = await fetch(`${baseUrl}/api/auth/session`, {
    headers: withCookies(headers),
  });
  const session = await parseJson<SessionResponse>(sessionRes);
  if (!session.user?.email) {
    throw new Error("Smoke login failed: session user missing");
  }

  console.log(`Session OK: ${session.user.email} (${session.user.role ?? "unknown-role"})`);

  const analyzeRes = await fetch(`${baseUrl}/api/analyze/${endpoint}`, {
    method: "POST",
    headers: withCookies({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ url, locale }),
  });
  const analyze = await parseJson<AnalyzeTaskResponse>(analyzeRes);
  if (!analyze.task?.id) {
    throw new Error(`Analyze request failed with HTTP ${analyzeRes.status}`);
  }

  console.log(
    `Task created: ${analyze.task.id} (${analyze.task.crawlEngine ?? "unknown-engine"} -> ${analyze.task.promptType ?? "unknown-prompt"})`,
  );

  for (let attempt = 1; attempt <= pollLimit; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const statusRes = await fetch(
      `${baseUrl}/api/analyze/${analyze.task.id}/status`,
      { headers: withCookies(headers) },
    );
    const status = await parseJson<TaskStatusResponse>(statusRes);
    const current = status.task?.status ?? status.status ?? "unknown";
    console.log(`Poll ${attempt}: ${current}`);

    if (current === "done") {
      const report = status.task?.report ?? {};
      const keys = Object.keys(report);
      const studio = report.studio && typeof report.studio === "object"
        ? (report.studio as Record<string, unknown>)
        : null;
      console.log(
        JSON.stringify(
          {
            outcome: "done",
            taskId: analyze.task.id,
            urlType: status.task?.urlType ?? null,
            crawlEngine: status.task?.crawlEngine ?? null,
            reportKeys: keys,
            hasSignalMap: keys.includes("signalMap"),
            hasStudio: keys.includes("studio"),
            hasProviderTrace: keys.includes("providerTrace"),
            hasStudioProviderTrace: !!studio?.providerTrace,
          },
          null,
          2,
        ),
      );
      return;
    }

    if (current === "failed") {
      throw new Error(status.task?.errorMsg || status.errorMsg || "Smoke analysis failed");
    }
  }

  throw new Error(`Smoke test timed out after ${pollLimit} polls`);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Smoke test failed: ${message}`);
  process.exit(1);
});
