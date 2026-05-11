import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Upstash Ratelimit uses Redis Lua (`EVALSHA`). NOPERM on `evalsha` usually means:
 * - Wrong product/credentials (not Upstash REST), read-only token, or ACL blocking scripts.
 * - Fix credentials in the Upstash console, **or** set `RATE_LIMIT_DISABLED=true` in `.env` for local dev only.
 *
 * `analytics` talks to Redis extra pipelines; keep it off unless you use Upstash analytics dashboards.
 */
function cleanEnv(value?: string): string {
  if (!value) return "";
  const trimmed = value.trim();
  return trimmed.replace(/^['"]|['"]$/g, "");
}

const explicitDisable = process.env.RATE_LIMIT_DISABLED?.toLowerCase() === "true";
const upstashUrl = cleanEnv(process.env.UPSTASH_REDIS_REST_URL);
const upstashToken = cleanEnv(process.env.UPSTASH_REDIS_REST_TOKEN);
const hasUpstashCreds = Boolean(upstashUrl) && Boolean(upstashToken);
const rateLimitDisabled = explicitDisable || !hasUpstashCreds;
const redisClient = hasUpstashCreds
  ? new Redis({ url: upstashUrl, token: upstashToken })
  : null;



const noopRatelimit = {limit: (_identifier: string) => {
  const reset = Date.now() + 60_000;
  return Promise.resolve({
    success: true,
    limit: 999999,
    remaining: 999999,
    reset,
    pending: Promise.resolve(),
  });
}};

export const ProveItRateLimit = rateLimitDisabled
  ? noopRatelimit
  : new Ratelimit({
      redis: redisClient!,
      limiter: Ratelimit.slidingWindow(50, "1m"),
      analytics: false,
      prefix: "@upstash/ratelimit",
    });

export const refreshRatelimit = rateLimitDisabled
  ? noopRatelimit
  : new Ratelimit({
      redis: redisClient!,
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      analytics: false,
      prefix: "@upstash/ratelimit/refresh",
    });
