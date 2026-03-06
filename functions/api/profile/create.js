import { readSessionUser } from "../../_lib/auth.js";
import { getProfileByOwner, saveProfile, normalizeAccountFromSession, normalizeAvatarFromSession, normalizeDisplayFromSession } from "../../_lib/db.js";

export async function onRequestPost({ request, env }) {
  const user = await readSessionUser(request, env);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);

  const data = await request.json().catch(() => ({}));
  const slug = slugify(data.slug || data.username || "");
  if (!slug || slug.length < 3) return json({ ok: false, error: "invalid_slug" }, 400);

  const account = normalizeAccountFromSession(user);
  const existing = await getProfileByOwner(env, account);
  if (existing) return json({ ok: false, error: "already_has_profile", slug: existing }, 409);

  await saveProfile(env, {
    slug,
    owner_account: account,
    owner_display: normalizeDisplayFromSession(user),
    owner_avatar: normalizeAvatarFromSession(user),
    owner_bio: "",
    created_at: new Date().toISOString(),
    updated_at: null
  });

  return json({ ok: true, slug });
}

function slugify(text) {
  return String(text || "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "");
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
