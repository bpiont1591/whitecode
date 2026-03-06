import { readSessionUser } from "../../../_lib/auth.js";
import { deleteReviewById, getProfile, normalizeAccountFromSession, resolveReport } from "../../../_lib/db.js";

export async function onRequestPost({ request, env }) {
  const user = await readSessionUser(request, env);
  if (!isAdmin(user, env)) return json({ ok: false, error: "forbidden" }, 403);

  const data = await request.json().catch(() => ({}));
  const profileSlug = slugify(data.profileSlug || "");
  const reportId = String(data.reportId || "").trim();
  const action = String(data.action || "").trim();

  if (!profileSlug || !reportId || !action) return json({ ok: false, error: "invalid_payload" }, 400);

  const profile = await getProfile(env, profileSlug);
  if (!profile) return json({ ok: false, error: "profile_not_found" }, 404);

  if (action === "delete_review") {
    const reviewId = String(data.reviewId || "").trim();
    if (!reviewId) return json({ ok: false, error: "missing_review_id" }, 400);
    await deleteReviewById(env, profileSlug, reviewId);
  }

  await resolveReport(env, reportId);
  return json({ ok: true });
}

function isAdmin(user, env) {
  if (!user) return false;
  const account = normalizeAccountFromSession(user);
  const admin = String(env.ADMIN_ACCOUNT || "dc_1418289596457812088");
  return account === admin;
}

function slugify(text) {
  return String(text || "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "");
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
