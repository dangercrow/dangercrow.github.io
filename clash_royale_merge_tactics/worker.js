export default {
  async fetch(request, env, ctx) {
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
        const resp = await handlePlayersBatch(request, env, ctx);
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

async function handlePlayersBatch(request, env, ctx) {
  const url = new URL(request.url);
  const { auth, usingDefault } = getAuthOrDefault(request, env);
  const myClanTag = myClan(env);

  // Only accept CSV: /players?tags=%23AAA,%23BBB
  const csv = url.searchParams.get("tags");
  if (!csv) return new Response("Provide tags via ?tags=tag1,tag2,...", { status: 400 });

  // Normalize once
  const tags = csv
    .split(",")
    .map(s => normalizeTag(s)) // input should already be decoded by URLSearchParams
    .filter(Boolean);

  if (tags.length === 0) return new Response("No valid tags in ?tags=", { status: 400 });
  if (tags.length > 50) return new Response("Max 50 tags per request", { status: 400 });

  const cache = caches.default;
  const ttlSeconds = 300;

  const results = [];

  for (const tag of tags) {
    // Projection cache key: small derived data (cheap to parse)
    const projKey = new Request(`https://cache.local/player/${encodeTag(tag)}`, { method: "GET" });

    // 1) Cache hit?
    const cached = await cache.match(projKey);
    if (cached) {
      const item = await cached.json(); // small JSON
      if (usingDefault && (!item.clanTag || !sameTag(item.clanTag, myClanTag))) {
        return new Response("Default key restricted to MY_CLAN_TAG", { status: 403 });
      }
      results.push(item);
      continue;
    }

    // 2) Cache miss -> fetch upstream
    const upstreamUrl = `${UPSTREAM_BASE}/players/${encodeTag(tag)}`;
    const res = await fetch(upstreamUrl, { headers: { Authorization: auth } });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return new Response(`Upstream error for ${tag}: HTTP ${res.status} ${text}`, { status: 502 });
    }

    const player = await res.json(); // expensive parse (only on miss)

    const item = {
      tag,
      name: player?.name ?? null,
      trophyRoad: Number.isFinite(player?.trophies) ? player.trophies : null,
      mergeTactics: extractAutoChessTrophies(player),
      clanTag: player?.clan?.tag ?? null,
    };

    if (usingDefault && (!item.clanTag || !sameTag(item.clanTag, myClanTag))) {
      return new Response("Default key restricted to MY_CLAN_TAG", { status: 403 });
    }

    // Cache the small projection (async)
    const toCache = new Response(JSON.stringify(item), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${ttlSeconds}`,
      },
    });
    ctx.waitUntil(cache.put(projKey, toCache.clone()));

    results.push(item);
  }

  // Optional: let clients cache this combined response briefly too
  return new Response(JSON.stringify({ items: results }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=30",
    },
  });
}
