import { readSessionUser } from "../../_lib/auth.js";
import { createReport, createReportId, getProfile, normalizeAccountFromSession } from "../../_lib/db.js";

export async function onRequestPost({ request, env }) {
  const user = await readSessionUser(request, env);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);

  const data = await request.json().catch(() => ({}));
  const profileSlug = slugify(data.user || "");
  const reviewId = String(data.reviewId || "").trim();

  if (!profileSlug || !reviewId) return json({ ok: false, error: "invalid_payload" }, 400);

  const profile = await getProfile(env, profileSlug);
  if (!profile) return json({ ok: false, error: "profile_not_found" }, 404);

  const exists = (profile.reviews || []).find((r) => r.id === reviewId);
  if (!exists) return json({ ok: false, error: "review_not_found" }, 404);

  await createReport(env, {
    id: createReportId(),
    profile_slug: profileSlug,
    review_id: reviewId,
    reported_by: normalizeAccountFromSession(user),
    reason: String(data.reason || "").trim().slice(0, 400),
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
