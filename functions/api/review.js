import { readSessionUser } from "../_lib/auth.js";
import {
  createReviewId,
  getProfile,
  isBlockedAccount,
  normalizeAccountFromSession,
  normalizeAvatarFromSession,
  normalizeDisplayFromSession,
  saveReview
} from "../_lib/db.js";

const VALID_RATINGS = new Set(["legit", "sold", "scam"]);

export async function onRequestPost({ request, env }) {
  const user = await readSessionUser(request, env);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);

  const data = await request.json().catch(() => ({}));
  const profileSlug = slugify(data.user || data.profileSlug || "");
  const rating = String(data.rating || "").trim();
  const reason = String(data.reason || "").trim();

  if (!profileSlug) return json({ ok: false, error: "missing_profile" }, 400);
  if (!VALID_RATINGS.has(rating)) return json({ ok: false, error: "invalid_rating" }, 400);
  if (!reason || reason.length > 500) return json({ ok: false, error: "invalid_reason" }, 400);

  const profile = await getProfile(env, profileSlug);
  if (!profile) return json({ ok: false, error: "profile_not_found" }, 404);

  const account = normalizeAccountFromSession(user);
  if (await isBlockedAccount(env, account)) {
    return json({ ok: false, error: "account_blocked" }, 403);
  }

  if (profile.owner_account === account) {
    return json({ ok: false, error: "owner_cannot_review" }, 403);
  }

  await saveReview(env, {
    id: createReviewId(),
    profile_slug: profileSlug,
    rating,
    reason,
    reviewer_account: account,
    reviewer_display: normalizeDisplayFromSession(user),
    reviewer_avatar: normalizeAvatarFromSession(user),
    created_at: new Date().toISOString()
  });

  return json({ ok: true });
}

function slugify(text) {
  return String(text || "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "");
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
