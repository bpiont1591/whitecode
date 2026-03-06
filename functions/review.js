import { readSessionUser } from "./_lib/auth.js";
import {
  createReviewId,
  getProfile,
  normalizeAccountFromSession,
  normalizeAvatarFromSession,
  normalizeDisplayFromSession,
  saveProfile,
  saveReview
} from "./_lib/db.js";

const DEFAULT_PROFILE = "whitecode";

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
    const stars = Number(data.rating || 0);
    const profileSlug = String(data.profileSlug || env.DEFAULT_PROFILE_SLUG || DEFAULT_PROFILE).trim().toLowerCase();

    if (!review) return json({ ok: false, error: "Wpisz treść opinii." }, 400);
    if (review.length > 1200) return json({ ok: false, error: "Opinia jest za długa (max 1200)." }, 400);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) return json({ ok: false, error: "Wybierz ocenę od 1 do 5." }, 400);

    let profile = await getProfile(env, profileSlug);
    if (!profile) {
      await saveProfile(env, {
        slug: profileSlug,
        owner_account: "system",
        owner_display: "System",
        owner_avatar: null,
        owner_bio: "Profil systemowy dla opinii landing page.",
        created_at: new Date().toISOString(),
        updated_at: null
      });
      profile = await getProfile(env, profileSlug);
    }

    const reviewerAccount = normalizeAccountFromSession(user);
    if (profile.owner_account === reviewerAccount) {
      return json({ ok: false, error: "Właściciel profilu nie może wystawić opinii sam sobie." }, 403);
    }

    const ok = await saveReview(env, {
      id: createReviewId(),
      profile_slug: profileSlug,
      rating: fromStarsToRating(stars),
      reason: review,
      reviewer_account: reviewerAccount,
      reviewer_display: normalizeDisplayFromSession(user),
      reviewer_avatar: normalizeAvatarFromSession(user),
      created_at: new Date().toISOString()
    });

    if (!ok) {
      return json({ ok: false, error: "Nie udało się zapisać opinii." }, 500);
    }

    return json({
      ok: true,
      item: {
        created_at: new Date().toISOString(),
        discord_user_id: String(user.sub || ""),
        discord_user_display: normalizeDisplayFromSession(user),
        review,
        rating: stars
      }
    });
  } catch (error) {
    return json({ ok: false, error: "Błąd serwera podczas dodawania opinii." }, 500);
  }
}

function fromStarsToRating(stars) {
  if (stars <= 2) return "scam";
  if (stars === 3) return "sold";
  return "legit";
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
