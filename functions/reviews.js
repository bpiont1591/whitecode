import { ensureSchema, resolveD1DatabaseForUsage } from "./_lib/db.js";

export async function onRequestGet({ env }) {
  try {
    const dbInfo = await resolveD1DatabaseForUsage(env);
    const db = dbInfo.db;
    if (!db) {
      const hint = (dbInfo.reason === "ambiguous" || dbInfo.reason === "probe_failed")
        ? `Wykryto wiele bindingów D1 (${dbInfo.candidates.join(", ")}). Ustaw D1_BINDING_NAME.`
        : "Ustaw poprawny D1 binding lub D1_BINDING_NAME.";
      return json({ ok: false, items: [], error: `Brak bindowania D1 w Functions. ${hint}` }, 500);
    }

    await ensureSchema(db);
    const result = await db.prepare(`
      SELECT id, created_at, discord_user_display, review, rating
      FROM reviews
      ORDER BY id DESC
      LIMIT 24
    `).all();

    const items = Array.isArray(result?.results) ? result.results : [];
    return json({ ok: true, items });
  } catch {
    return json({ ok: false, items: [], error: "Nie udało się pobrać opinii z bazy D1 (sprawdź binding i utworzenie tabel)." }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
