export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (request.method !== "GET") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders() });
    }

    const path = url.pathname;

    const isClanMembers =
      path.startsWith("/clans/") &&
      path.endsWith("/members") &&
      path.split("/").length === 4;

    const isSinglePlayer =
      path.startsWith("/players/") &&
      path.split("/").length === 3;

    if (!isClanMembers && !isSinglePlayer) {
      return new Response("Not Found", { status: 404, headers: corsHeaders() });
    }

    // Expect the browser to send Authorization: Bearer <token>
    const auth = request.headers.get("Authorization");
    if (!auth) {
      return new Response("Missing Authorization header", { status: 400, headers: corsHeaders() });
    }

    // Forward to RoyaleAPI proxy (server-side, so no browser CORS issue)
    const upstreamUrl = "https://proxy.royaleapi.dev/v1" + path;

    const upstream = await fetch(upstreamUrl, {
      headers: { Authorization: auth },
    });

    return withCors(upstream);
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

async function withCors(upstream) {
  const body = await upstream.arrayBuffer();
  const headers = new Headers(upstream.headers);

  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  return new Response(body, { status: upstream.status, headers });
}

