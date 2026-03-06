import { ensureStorage, hasReviewsTable } from "../_lib/db.js";

export async function onRequestGet({ env }) {
  try {
    const storage = await ensureStorage(env);
    const d1Connected = storage.mode === "d1";
    const tableReady = d1Connected ? await hasReviewsTable(env) : false;

    if (!d1Connected) {
      return json({
        ok: false,
        error: "Brak aktywnego bindowania D1 w Functions.",
        mode: storage.mode,
        reason: storage.info?.reason || null,
        hint: "Ustaw poprawny binding (np. DB) lub D1_BINDING_NAME i zrób redeploy."
      }, 500);
    }

    if (!tableReady) {
      return json({
        ok: false,
        error: "Nie udało się potwierdzić tabeli reviews w D1.",
        mode: storage.mode,
        reason: storage.info?.reason || null,
        binding: storage.info?.bindingName || null
      }, 500);
    }

    return json({
      ok: true,
      mode: storage.mode,
      reason: storage.info?.reason || null,
      binding: storage.info?.bindingName || null,
      tables: ["reviews"],
      message: "System opini gotowy. Aktywna tylko tabela reviews."
    });
  } catch (error) {
    return json({
      ok: false,
      error: "Nie udało się zainicjalizować systemu opini.",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
