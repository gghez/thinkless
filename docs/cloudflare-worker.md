# Cloudflare Workers — What It Is and How to Create One

## What is a Cloudflare Worker?

A Cloudflare Worker is a piece of code (JavaScript/TypeScript) that runs **at the edge of Cloudflare's network** — on distributed servers around the world, close to the end user.

Key properties:
- No server to manage
- Code executes on each incoming HTTP request
- Very low latency (nearest datacenter responds)
- Free tier: up to 100,000 requests/day

The runtime is based on the browser **Service Workers** spec, but running server-side.

## Why it fits Thinkless

The ingestion endpoint needs to:
- receive an anonymous `POST` with no auth
- validate the payload
- forward it downstream (GitHub Issues)
- be available over HTTPS with no infrastructure to maintain

A Cloudflare Worker covers all of this with zero ops overhead.

## Deployed instance

- **URL**: `https://thinkless-ingest.gregory-ghez.workers.dev`
- **Code**: `worker/src/index.js`
- **Config**: `worker/wrangler.toml`
- **Secrets set**: `GITHUB_TOKEN`, `GITHUB_REPO`

## Setup

### 1. Install Wrangler (official CLI)

```bash
# install globally (requires sudo) or use npx
npx wrangler login
```

### 2. Create a project manually

The interactive `wrangler init` requires a TTY. Create the files directly:
- `worker/wrangler.toml`
- `worker/src/index.js`
- `worker/package.json`

### 3. Deploy

```bash
npx wrangler deploy --cwd worker
```

Cloudflare provides a URL immediately: `<name>.<account>.workers.dev`.

## Storing secrets

Secrets are stored as Worker secrets, never in code:

```bash
echo "value" | npx wrangler secret put SECRET_NAME --cwd worker
```

Requires `CLOUDFLARE_API_TOKEN` set in the environment (create one at `dash.cloudflare.com/profile/api-tokens` with the "Edit Cloudflare Workers" template).

Accessed in the Worker via `env.SECRET_NAME`.
