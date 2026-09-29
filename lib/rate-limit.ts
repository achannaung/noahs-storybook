// Shared in-memory rate limiter for the Pages Functions.
// NOTE: On Cloudflare's edge network each isolate keeps its own counters,
// so this is approximate per-location limiting — good enough as basic
// abuse protection for a family app.

const hits = new Map<string, number[]>();

/** Returns true if the request is allowed, false if the rate limit is hit. */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const previous = hits.get(key) ?? [];
  const fresh = previous.filter((t) => now - t < windowMs);
  if (fresh.length >= limit) {
    hits.set(key, fresh);
    return false;
  }
  fresh.push(now);
  hits.set(key, fresh);
  return true;
}

/** Client IP on Cloudflare (cf-connecting-ip is set by the edge). */
export function getClientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") || "unknown";
}
