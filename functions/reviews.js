const RECENT_REVIEWS = globalThis.__WHITECODE_RECENT_REVIEWS__ || (globalThis.__WHITECODE_RECENT_REVIEWS__ = []);

export async function onRequestGet() {
  return json({ ok: true, items: RECENT_REVIEWS.slice(0, 24) });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
