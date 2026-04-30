/**
 * Resolves a client IP for rate limiting.
 *
 * `x-forwarded-for` may be a comma-separated chain (client, proxy1, proxy2). We take the
 * **first** entry, which is the usual convention for the original client when proxies append.
 *
 * Without a **trusted** reverse proxy that strips/forges client-controlled values, headers can be
 * spoofed — configure your host (e.g. Vercel, nginx) so only your edge sets these headers.
 */
export function getClientIpForRateLimit(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "127.0.0.1";
}
