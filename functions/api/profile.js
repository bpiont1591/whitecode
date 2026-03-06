import { getProfile } from "../_lib/db.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const user = slugify(url.searchParams.get("user") || "");
  if (!user) return json({ ok: false, error: "missing_user" }, 400);

  const profile = await getProfile(env, user);
  if (!profile) return json({ ok: false, error: "profile_not_found" }, 404);

  const out = {
    owner: profile.owner_account,
    ownerDisplay: profile.owner_display,
    ownerAvatar: profile.owner_avatar,
    ownerBio: profile.owner_bio || "",
    reviews: (profile.reviews || []).map((r) => ({
      id: r.id,
      rating: r.rating,
      reason: r.reason,
      reviewerAccount: r.reviewer_account,
      reviewerDisplay: r.reviewer_display,
      reviewerAvatar: r.reviewer_avatar,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    })),
    reports: (profile.reports || []).map((r) => ({
      id: r.id,
      reviewId: r.review_id,
      reportedBy: r.reported_by,
      reason: r.reason,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }))
  };

  return json({ ok: true, profile: out });
}

function slugify(text) {
  return String(text || "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "");
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
