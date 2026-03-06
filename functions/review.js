import { readSessionUser } from "./_lib/auth.js";
import { normalizeDisplayFromSession, saveReview } from "./_lib/db.js";

export async function onRequestPost({ request, env }) {
  try {
    const user = await readSessionUser(request, env);
    if (!user) return json({ ok: false, error: "Musisz zalogować się przez Discord." }, 401);

    const originError = validateOrigin(request);
    if (originError) return json({ ok: false, error: originError }, 403);

    const ct = request.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return json({ ok: false, error: "Nieprawidłowy typ danych." }, 415);
    }

    const data = await request.json();
    const review = String(data.review || "").trim();
    const rating = Number(data.rating || 0);

    if (!review) return json({ ok: false, error: "Wpisz treść opinii." }, 400);
    if (review.length > 1200) return json({ ok: false, error: "Opinia jest za długa (max 1200)." }, 400);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return json({ ok: false, error: "Wybierz ocenę od 1 do 5." }, 400);
    }

    await saveReview(env, {
      created_at: new Date().toISOString(),
      discord_user_id: String(user.sub || ""),
      discord_user_display: normalizeDisplayFromSession(user),
      review,
      rating
    });

    return json({
      ok: true,
      item: {
        created_at: new Date().toISOString(),
        discord_user_id: String(user.sub || ""),
        discord_user_display: normalizeDisplayFromSession(user),
        review,
        rating
      }
    });
  } catch {
    return json({ ok: false, error: "Błąd serwera podczas dodawania opinii." }, 500);
  }
}

function validateOrigin(request) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const url = new URL(request.url);

  if (origin) {
    try {
      const o = new URL(origin);
      if (o.host !== url.host) return "Niedozwolone źródło żądania.";
    } catch {
      return "Niedozwolone źródło żądania.";
    }
  }

  if (referer) {
    try {
      const r = new URL(referer);
      if (r.host !== url.host) return "Niedozwolone źródło żądania.";
    } catch {
      return "Niedozwolone źródło żądania.";
    }
  }

  return null;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
