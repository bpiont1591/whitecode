import { listRecentReviews } from "./_lib/db.js";

export async function onRequestGet({ env }) {
  try {
    const items = await listRecentReviews(env, 24);
    return json({ ok: true, items });
  } catch {
    return json({ ok: false, error: "Nie udało się pobrać opinii." }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
