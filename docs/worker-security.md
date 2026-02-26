# Worker Security — Rate Limiting and Abuse Protection

## Threat model

The ingestion endpoint is public and unauthenticated by design. An attacker flooding it
would create hundreds of GitHub Issues on the thinkless repo, exhausting the service
account's API quota (5,000 req/hour) and potentially triggering a GitHub ban.

The following layers address this.

## Layer 1 — Cloudflare native rate limiting

Declare a rate limit binding in `wrangler.toml`:

```toml
[[unsafe.bindings]]
name = "RATE_LIMITER"
type = "ratelimit"
namespace_id = "1"
simple = { limit = 5, period = 60 }
```

Enforce it at the top of the Worker before any processing:

```js
const { success } = await env.RATE_LIMITER.limit({ key: request.headers.get("CF-Connecting-IP") });
if (!success) return new Response("Too Many Requests", { status: 429 });
```

5 requests per IP per minute. A legitimate contributor will never exceed one capture per session.

## Layer 2 — Cloudflare WAF (free tier)

In the Cloudflare dashboard:
- Enable bot fight mode (blocks known bad bots automatically)
- Optionally restrict to expected countries if the contributor base is geographically bounded

## Layer 3 — Daily circuit breaker (Cloudflare KV)

Cap the total number of GitHub Issues created per day, well below the GitHub API quota:

```js
const count = parseInt(await env.KV.get("issues_today") ?? "0");
if (count >= 200) return new Response("Service Unavailable", { status: 503 });
await env.KV.put("issues_today", String(count + 1), { expirationTtl: 86400 });
```

Reset is automatic after 24 hours via KV TTL.

## Layer 4 — Payload validation before hitting GitHub

Reject malformed or incomplete payloads before any downstream call:

```js
const required = ["schema_version", "captured_at", "problem", "solution", "insight"];
for (const field of required) {
  if (!body[field]) return new Response("Bad Request", { status: 400 });
}
```

An attacker sending garbage never reaches the GitHub API.

## Summary

| Layer | Where | Protects against |
|---|---|---|
| Rate limiting | Cloudflare edge | burst from a single IP |
| WAF / bot fight | Cloudflare dashboard | known bots, reputation-based blocks |
| Daily cap (KV) | Worker code | sustained low-rate abuse across IPs |
| Payload validation | Worker code | junk payloads reaching GitHub API |
