import { getProfile } from "./_lib/db.js";

const DEFAULT_PROFILE = "whitecode";

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const profileSlug = String(url.searchParams.get("profile") || env.DEFAULT_PROFILE_SLUG || DEFAULT_PROFILE).trim().toLowerCase();

    const profile = await getProfile(env, profileSlug);
    if (!profile) {
      return json({ ok: true, items: [] });
    }

    const items = (profile.reviews || []).slice(0, 24).map((row) => ({
      created_at: row.created_at,
      discord_user_id: String(row.reviewer_account || "").replace(/^dc_/, ""),
      discord_user_display: row.reviewer_display || row.reviewer_account || "Użytkownik",
      review: row.reason || "",
      rating: fromLegacyRating(row.rating)
    }));

    return json({ ok: true, items });
  } catch {
    return json({ ok: false, error: "Nie udało się pobrać opinii." }, 500);
  }
}

function fromLegacyRating(rating) {
  if (rating === "scam") return 1;
  if (rating === "sold") return 3;
  return 5;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
