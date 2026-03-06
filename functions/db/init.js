import { ensureSchema, resolveD1DatabaseForUsage } from "../_lib/db.js";

export async function onRequestGet({ env }) {
  try {
    const dbInfo = await resolveD1DatabaseForUsage(env);
    const db = dbInfo.db;
    if (!db) {
      const hint = (dbInfo.reason === "ambiguous" || dbInfo.reason === "probe_failed")
        ? `Wykryto wiele bindingów D1 (${dbInfo.candidates.join(", ")}). Ustaw D1_BINDING_NAME.`
        : "Ustaw poprawny D1 binding lub D1_BINDING_NAME.";

      return json({ ok: false, error: `Brak działającego bindowania D1. ${hint}` }, 500);
    }

    await ensureSchema(db);
    return json({ ok: true, binding: dbInfo.bindingName || null });
  } catch {
    return json({ ok: false, error: "Nie udało się zainicjalizować tabel D1." }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
