import { ensureSchema } from "./_lib/db.js";

export async function onRequestGet({ env }) {
  try {
    if (!env.DB) {
      return json({ ok: true, items: [] });
    }

    await ensureSchema(env.DB);
    const result = await env.DB.prepare(`
      SELECT id, created_at, discord_user_display, review, rating
      FROM reviews
      ORDER BY id DESC
      LIMIT 24
    `).all();

    const items = Array.isArray(result?.results) ? result.results : [];
    return json({ ok: true, items });
  } catch {
    return json({ ok: false, items: [] }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
