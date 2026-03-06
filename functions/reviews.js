import { ensureSchema, resolveD1DatabaseForUsage } from "./_lib/db.js";

const RECENT_REVIEWS = globalThis.__WHITECODE_RECENT_REVIEWS__ || (globalThis.__WHITECODE_RECENT_REVIEWS__ = []);

export async function onRequestGet({ env }) {
  try {
    const dbInfo = await resolveD1DatabaseForUsage(env);
    const db = dbInfo.db;

    if (!db) {
      return json({ ok: true, items: RECENT_REVIEWS.slice(0, 24), warning: "Brak D1 — pokazuję listę z pamięci runtime." });
    }

    try {
      await ensureSchema(db);
    } catch {
      // continue and try direct read from reviews
    }

    const result = await db.prepare(`
      SELECT id, created_at, discord_user_id, discord_user_display, review, rating
      FROM reviews
      ORDER BY id DESC
      LIMIT 24
    `).all();

    const items = Array.isArray(result?.results) ? result.results : [];
    return json({ ok: true, items });
  } catch {
    return json({ ok: true, items: RECENT_REVIEWS.slice(0, 24), warning: "Błąd odczytu D1 — pokazuję listę z pamięci runtime." });
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
