@AGENTS.md

# ViralGenie

Competitor analysis tool that crawls URLs and generates AI-powered reports.

## Tech Stack

- **Frontend:** Next.js 16 (App Router, TypeScript, Tailwind)
- **Database:** PostgreSQL 16 (local via Homebrew, db `viralgenie_dev`)
- **ORM:** Prisma 7 with `@prisma/adapter-pg` (Prisma 7 requires a driver adapter — `new PrismaClient()` alone won't work)
- **AI:** Claude API, model `claude-sonnet-4-6`
- **Crawlers:** Supadata SDK, Firecrawl SDK, Apify SDK

## Architecture

Three-layer model:

1. **Frontend** (Next.js) — UI not yet built.
2. **API Router** — `app/api/analyze/route.ts` does URL pattern matching to dispatch to one of three crawl engines.
3. **AI Processor** — Claude with system prompts that force structured JSON output per analysis type.

Plus two cross-cutting concerns:
- **Cost guard** with per-service daily limits (env: `DAILY_<SERVICE>_LIMIT`).
- **URL cache** with 24h TTL keyed on normalized URL.

## URL → Engine Routing

`src/lib/url-router/index.ts` strips tracking params (utm_*, fbclid, gclid, etc.) then matches hostname:

| Pattern | Engine | Platform |
|---|---|---|
| `youtube.com` / `youtu.be` / `m.youtube.com` | supadata | youtube |
| `tiktok.com` / `vm.tiktok.com` | supadata | tiktok |
| `twitter.com` / `x.com` / `t.co` | supadata | x |
| `*amazon.*` / `*ebay.*` / `*.shopify.com` / `*.myshopify.com` | apify | ecommerce |
| (default) | firecrawl | blog |

**Known gap:** the Shopify pattern only catches `.myshopify.com` — most real Shopify stores use custom domains and route to firecrawl. Future work: detect via response signature (e.g. `meta[name="shopify-checkout-api-token"]`).

## Key Files

| Path | Purpose |
|---|---|
| `app/api/analyze/route.ts` | Main pipeline: validate → cache check → limit check → create task → crawl → normalize → analyze → save report |
| `src/lib/crawlers/supadata.ts` | YouTube/TikTok/X via `client.metadata()` + `client.transcript()` (the per-platform `youtube.video()` / `youtube.transcript()` are deprecated in v1.4) |
| `src/lib/crawlers/firecrawl.ts` | Blog/article scraping via `client.scrape(url, { formats: ["markdown"], onlyMainContent: true })` |
| `src/lib/crawlers/apify.ts` | Ecommerce via `apify/web-scraper` actor with custom `pageFunction` (jQuery-injected). 120s actor timeout, 130s SDK wait |
| `src/lib/ai/client.ts` | Anthropic SDK wrapper. `analyzeContent(markdown, analysisType)` with prompt caching on system prompt |
| `src/lib/ai/prompts.ts` | Three system prompts (script_teardown / product_compare / viral_rewrite) that lock Claude into specific JSON shapes |
| `src/lib/normalizer/index.ts` | `normalizeToMarkdown(content)` + `buildClaudeContext(content, type)` |
| `src/lib/cost-guard/index.ts` | `checkLimit(service)` / `recordUsage(service, costUsd)` against `ApiUsage` table |
| `src/lib/db.ts` | Prisma singleton via `globalThis`, uses `new PrismaPg(DATABASE_URL)` adapter |
| `src/types/index.ts` | `UnifiedContent`, `Platform`, `AnalysisType`, `CrawlEngine`, `TaskStatus` |
| `prisma/schema.prisma` | Three models: `AnalysisTask`, `ApiUsage`, `UrlCache` |
| `prisma.config.ts` | Prisma 7 requires `url` outside `schema.prisma` — this file loads `.env.local` and supplies `DATABASE_URL` |
| `next.config.ts` | `serverExternalPackages: ["apify-client"]` — required because apify-client uses dynamic `require()` Turbopack can't bundle |

## Dev Environment

- Dev server runs on **port 3001** (port 3000 is occupied by another local project).
- Database: `postgresql://davidz@localhost:5432/viralgenie_dev` — user `davidz`, no password.
- API keys live in `.env.local` (gitignored): `SUPADATA_API_KEY`, `FIRECRAWL_API_KEY`, `APIFY_API_TOKEN`, `ANTHROPIC_API_KEY`, `AUTH_PASSWORD`, `NEXTAUTH_SECRET`, plus daily limits.

### Common gotcha — shell env vs `.env.local`

Next.js's `.env.local` loader does **not** override existing `process.env` values. If your shell init exports any of the keys above (especially `FIRECRAWL_API_KEY`), the stale shell value wins and silently breaks auth. To diagnose: `ps -p <pid> -E -o command | tr ' ' '\n' | grep <KEY>`. To fix: launch the dev server in a clean env (`env -u FIRECRAWL_API_KEY npm run dev`) or remove the export from your shell rc.

## Status

All three crawl engines verified end-to-end against live APIs:

- **Supadata** → YouTube (`youtube.com/watch?v=dQw4w9WgXcQ`): 33s, full transcript + metadata.
- **Firecrawl** → Blog (`anthropic.com/research/building-effective-agents`): 23s, 21K chars markdown.
- **Apify** → Shopify (`hydrogen-preview.myshopify.com/products/the-h2-snowboard`): 64s, schema.org/Product extraction with price + 7 image URLs.

**Next phase:**
1. Wire up frontend UI (currently only `app/page.tsx` boilerplate exists).
2. Add NextAuth.js authentication (creds + `AUTH_PASSWORD`/`NEXTAUTH_SECRET` already in env).
3. Task queue for concurrent requests (consider `p-queue` already installed, or BullMQ if more rigor needed).
