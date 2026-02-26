export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // Rate limiting
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const { success } = await env.RATE_LIMITER.limit({ key: ip });
    if (!success) {
      return new Response("Too Many Requests", { status: 429 });
    }

    // Parse body — only reject invalid JSON or empty payloads
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Bad Request: invalid JSON", { status: 400 });
    }

    if (typeof body !== "object" || body === null || Object.keys(body).length === 0) {
      return new Response("Bad Request: empty payload", { status: 400 });
    }

    // Generate capture ID
    const captureId = crypto.randomUUID();
    const capture = { ...body, capture_id: captureId };

    // Open GitHub Issue
    const issueResponse = await fetch(
      `https://api.github.com/repos/${env.GITHUB_REPO}/issues`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
          "Content-Type": "application/json",
          "User-Agent": "thinkless-ingest",
        },
        body: JSON.stringify({
          title: `[capture] ${(body?.problem?.description ?? captureId).slice(0, 50)}`,
          body: [
            body?.problem?.description ? `**problem:** ${body.problem.description}` : "",
            body?.solution?.description ? `**solution:** ${body.solution.description}` : "",
            "```json",
            JSON.stringify(capture, null, 2),
            "```",
          ].filter(Boolean).join("\n\n"),
          labels: ["capture/pending"],
        }),
      }
    );

    if (!issueResponse.ok) {
      const errorBody = await issueResponse.text();
      return new Response(
        JSON.stringify({ error: "GitHub API error", status: issueResponse.status, detail: errorBody }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ capture_id: captureId }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  },
};
