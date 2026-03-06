import { ensureSchema, hasD1HttpConfig, listRecentReviews, listRecentReviewsViaHttp, resolveD1DatabaseForUsage } from "./_lib/db.js";

const RECENT_REVIEWS = globalThis.__WHITECODE_RECENT_REVIEWS__ || (globalThis.__WHITECODE_RECENT_REVIEWS__ = []);

export async function onRequestGet({ env }) {
  try {
    const dbInfo = await resolveD1DatabaseForUsage(env);
    const db = dbInfo.db;

    if (!db) {
      if (hasD1HttpConfig(env)) {
        const items = await listRecentReviewsViaHttp(env, 24);
        return json({ ok: true, items, warning: "Odczyt przez D1 HTTP API (fallback bez bindingu)." });
      }

      return json({ ok: true, items: RECENT_REVIEWS.slice(0, 24), warning: "Brak D1 — pokazuję listę z pamięci runtime." });
    }

    try {
      await ensureSchema(db);
    } catch {
      // continue and try direct read from reviews
    }

    const items = await listRecentReviews(db, 24);
    return json({ ok: true, items });
  } catch {
    try {
      if (hasD1HttpConfig(env)) {
        const items = await listRecentReviewsViaHttp(env, 24);
        return json({ ok: true, items, warning: "Odczyt przez D1 HTTP API (fallback po błędzie bindingu)." });
      }
    } catch {
      // ignore
    }

    return json({ ok: true, items: RECENT_REVIEWS.slice(0, 24), warning: "Błąd odczytu D1 — pokazuję listę z pamięci runtime." });
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
