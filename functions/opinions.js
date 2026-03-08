const CACHE_KEY = "__WC_OPINIONS_CACHE__";
const CACHE_TTL_MS = 60_000;

function getCache() {
  if (!globalThis[CACHE_KEY]) {
    globalThis[CACHE_KEY] = { value: null, at: 0 };
  }
  return globalThis[CACHE_KEY];
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export async function onRequestGet({ env }) {
  const url = String(env.BOT_OPINIONS_URL || "").trim();
  const apiKey = String(env.BOT_OPINIONS_API_KEY || "").trim();

  if (!url) {
    return json({ ok: false, error: "Brak BOT_OPINIONS_URL. Skonfiguruj endpoint opinii z bota." }, 500);
  }

  const cache = getCache();
  const now = Date.now();
  if (cache.value && now - cache.at < CACHE_TTL_MS) {
    return json({ ok: true, items: cache.value, stale: false });
  }

  try {
    const headers = new Headers();
    if (apiKey) headers.set("x-api-key", apiKey);

    const res = await fetch(url, { headers });
    const out = await res.json().catch(() => ({}));

    if (!res.ok || !Array.isArray(out.items)) {
      throw new Error(out.error || `Niepoprawna odpowiedź endpointu opinii (${res.status})`);
    }

    cache.value = out.items.slice(0, 30);
    cache.at = now;
    return json({ ok: true, items: cache.value });
  } catch (error) {
    if (cache.value) {
      return json({ ok: true, items: cache.value, stale: true });
    }
    return json({ ok: false, error: error instanceof Error ? error.message : "Nie udało się pobrać opinii." }, 502);
  }
}
