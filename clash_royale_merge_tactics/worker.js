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

    try {
      if (url.pathname.startsWith("/clans/") && url.pathname.endsWith("/members")) {
        const parts = url.pathname.split("/"); // ["", "clans", "{tag}", "members"]
        if (parts.length !== 4) return notFound();
        const clanTag = decodeURIComponent(parts[2]);
        const resp = await handleClanMembers(request, env, clanTag);
        return withCors(resp);
      }

      if (url.pathname === "/players") {
        const resp = await handlePlayersBatch(request, env);
        return withCors(resp);
      }

      return notFound();
    } catch (e) {
      return withCors(new Response(String(e?.message || e), { status: 500 }));
    }
  },
};

const UPSTREAM_BASE = "https://proxy.royaleapi.dev/v1";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function withCors(resp) {
  const h = new Headers(resp.headers);
  for (const [k, v] of Object.entries(corsHeaders())) h.set(k, v);
  return new Response(resp.body, { status: resp.status, headers: h });
}

function notFound() {
  return new Response("Not Found", { status: 404, headers: corsHeaders() });
}

function normalizeTag(tag) {
  const t = String(tag || "").trim().toUpperCase();
  if (!t) return null;
  return t.startsWith("#") ? t : `#${t}`;
}

function sameTag(a, b) {
  return normalizeTag(a) === normalizeTag(b);
}

function encodeTag(tag) {
  return encodeURIComponent(normalizeTag(tag));
}

function getAuthOrDefault(request, env) {
  const incoming = request.headers.get("Authorization");
  if (incoming && incoming.trim()) return { auth: incoming.trim(), usingDefault: false };

  const secret = (env.DEFAULT_API_KEY || "").trim();
  if (!secret) throw new Error("Missing secret env.DEFAULT_API_KEY");
  return { auth: `Bearer ${secret}`, usingDefault: true };
}

function myClan(env) {
  const t = normalizeTag(env.MY_CLAN_TAG);
  if (!t) throw new Error("Missing env.MY_CLAN_TAG");
  return t;
}

function extractAutoChessTrophies(player) {
  const progress = player?.progress;
  if (!progress || typeof progress !== "object") return null;
  for (const [k, v] of Object.entries(progress)) {
    if (typeof k === "string" && k.startsWith("AutoChess_")) {
      const t = v?.trophies;
      return Number.isFinite(t) ? t : null;
    }
  }
  return null;
}

async function handleClanMembers(request, env, clanTagParam) {
  const { auth, usingDefault } = getAuthOrDefault(request, env);
  const clanTag = normalizeTag(clanTagParam);
  if (!clanTag) return new Response("Bad clan tag", { status: 400 });

  if (usingDefault && !sameTag(clanTag, myClan(env))) {
    return new Response("Default key restricted to MY_CLAN_TAG", { status: 403 });
  }

  const upstreamUrl = `${UPSTREAM_BASE}/clans/${encodeTag(clanTag)}/members`;
  return fetch(upstreamUrl, { headers: { Authorization: auth } });
}

async function handlePlayersBatch(request, env) {
  const url = new URL(request.url);
  const { auth, usingDefault } = getAuthOrDefault(request, env);
  const myClanTag = myClan(env);

  // Only accept CSV: /players?tags=%23AAA,%23BBB
  const csv = url.searchParams.get("tags");
  if (!csv) return new Response("Provide tags via ?tags=tag1,tag2,...", { status: 400 });

  let tags = csv.split(",")
    .map(s => normalizeTag(decodeURIComponent(s)))
    .filter(Boolean);

  if (tags.length === 0) return new Response("No valid tags in ?tags=", { status: 400 });
  if (tags.length > 50) return new Response("Max 50 tags per request", { status: 400 });

  const results = [];

  // Sequential fetch keeps things simple and avoids connection fanout.
  // Still within Free plan subrequest cap: N players => N subrequests.
  for (const tag of tags) {
    const upstreamUrl = `${UPSTREAM_BASE}/players/${encodeTag(tag)}`;
    const res = await fetch(upstreamUrl, { headers: { Authorization: auth } });

    if (!res.ok) {
      // Upstream error -> fail whole request (consistent with your “fail whole request” stance)
      const text = await res.text().catch(() => "");
      return new Response(`Upstream error for ${tag}: HTTP ${res.status} ${text}`, { status: 502 });
    }

    const player = await res.json();

    // Default-key restriction: every player must be in your clan
    if (usingDefault) {
      const playerClan = player?.clan?.tag;
      if (!playerClan || !sameTag(playerClan, myClanTag)) {
        return new Response("Default key restricted to MY_CLAN_TAG", { status: 403 });
      }
    }

    results.push({
      tag,
      name: player?.name ?? null,
      trophyRoad: Number.isFinite(player?.trophies) ? player.trophies : null,
      mergeTactics: extractAutoChessTrophies(player),
    });
  }

  return new Response(JSON.stringify({ items: results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
