# Provider Routing Matrix

This document describes which upstream provider ViralGenie should prefer for each platform and how we should think about fallbacks in production.

## Primary routing

| Platform | Primary provider | Current reason |
| --- | --- | --- |
| YouTube | `tikhub` | Better fit with the new social-first product direction and more consistent metadata coverage. |
| TikTok | `tikhub` | Stronger short-video crawling path and better alignment with our current workflows. |
| Instagram | `tikhub` | Keeps video/social routing consistent with the rest of the stack. |
| Douyin | `tikhub` | Best current path for Chinese short-video links. |
| Xiaohongshu | `tikhub` | First attempt goes through TikHub so we keep one main social provider. |
| Bilibili | `tikhub` | Best current direct route in the stack. |
| X / Twitter | `supadata` | Still the only active X-specific provider in the codebase. |
| Blog / Web | `firecrawl` | Strongest generic website extraction path. |
| Ecommerce | `apify` | Best existing generic commerce crawler. |
| Amazon | `amazon-apify` | Dedicated Amazon route. |

## Fallback routing

| Platform | Fallback | When it should be used |
| --- | --- | --- |
| YouTube | `supadata` | Only when TikHub fails. |
| TikTok | `supadata` | Only when TikHub fails, and only while Supadata plan health is acceptable. |
| Instagram | `firecrawl` | Only when TikHub fails. |
| Xiaohongshu | `rnote` | Only when TikHub fails. |
| Douyin | none | Fail loudly for now. |
| Bilibili | none | Fail loudly for now. |

## Operational notes

- `supadata` should be treated as a limited fallback provider, not as a primary social provider.
- Recent checks showed:
  - YouTube metadata requests are healthy and fast.
  - TikTok requests can succeed, but are more sensitive to plan limits and rate limits.
- `tikhub` should stay first in the routing order for social and video URLs.
- `firecrawl` remains the right default for websites, brand pages, and connection analysis from official domains.
- `rnote` is best kept as a narrow Xiaohongshu fallback until we have stronger confidence in long-run cost and coverage.

## Recommended next operational upgrades

1. Track provider failures by platform, not just by provider name.
2. Record whether a result came from a primary path or fallback path.
3. Add a daily smoke run for:
   - `tikhub` on YouTube or TikTok
   - `firecrawl` on a normal website
   - `supadata` on a YouTube URL
4. If TikTok on `supadata` starts failing more often with plan-limit or rate-limit errors, remove it from fallback for TikTok before touching the primary TikHub path.
