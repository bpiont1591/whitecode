import { ensureReviewsSchema } from "../_lib/reviewsStore.js";

export async function onRequestGet({ env }) {
  try {
    const info = await ensureReviewsSchema(env);
    return json({ ok: true, ...info, message: "System opini gotowy. Struktura JSON utworzona." });
  } catch (error) {
    return json({ ok: false, error: "Nie udało się przygotować struktury opini.", details: error instanceof Error ? error.message : String(error) }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
