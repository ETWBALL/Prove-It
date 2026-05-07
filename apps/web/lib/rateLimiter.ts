import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Upstash Ratelimit uses Redis Lua (`EVALSHA`). NOPERM on `evalsha` usually means:
 * - Wrong product/credentials (not Upstash REST), read-only token, or ACL blocking scripts.
 * - Fix credentials in the Upstash console, **or** set `RATE_LIMIT_DISABLED=true` in `.env` for local dev only.
 *
 * `analytics` talks to Redis extra pipelines; keep it off unless you use Upstash analytics dashboards.
 */
const explicitDisable = process.env.RATE_LIMIT_DISABLED?.toLowerCase() === "true";
const hasUpstashCreds =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
  Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);
const rateLimitDisabled = explicitDisable || !hasUpstashCreds;



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
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(50, "1m"),
      analytics: false,
      prefix: "@upstash/ratelimit",
    });

export const refreshRatelimit = rateLimitDisabled
  ? noopRatelimit
  : new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      analytics: false,
      prefix: "@upstash/ratelimit/refresh",
    });
