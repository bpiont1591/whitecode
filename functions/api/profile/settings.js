import { readSessionUser } from "../../_lib/auth.js";
import { getProfile, normalizeAccountFromSession, updateProfileSettings } from "../../_lib/db.js";

export async function onRequestPost({ request, env }) {
  const user = await readSessionUser(request, env);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);

  const data = await request.json().catch(() => ({}));
  const currentSlug = slugify(data.user || "");
  const nextSlug = slugify(data.nextSlug || currentSlug);
  const ownerBio = String(data.ownerBio || "").trim().slice(0, 500);

  if (!currentSlug || !nextSlug || nextSlug.length < 3) {
    return json({ ok: false, error: "invalid_slug" }, 400);
  }

  const profile = await getProfile(env, currentSlug);
  if (!profile) return json({ ok: false, error: "profile_not_found" }, 404);
  if (profile.owner_account !== normalizeAccountFromSession(user)) {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  const out = await updateProfileSettings(env, currentSlug, { nextSlug, ownerBio });
  if (!out.ok) return json({ ok: false, error: out.error }, out.error === "slug_taken" ? 409 : 400);
  return json({ ok: true, slug: out.slug });
}

function slugify(text) {
  return String(text || "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "");
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
