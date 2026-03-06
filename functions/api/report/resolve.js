import { readSessionUser } from "../../_lib/auth.js";
import { getProfile, normalizeAccountFromSession, resolveReport } from "../../_lib/db.js";

export async function onRequestPost({ request, env }) {
  const user = await readSessionUser(request, env);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);

  const data = await request.json().catch(() => ({}));
  const slug = slugify(data.user || "");
  const reportId = String(data.reportId || "").trim();
  if (!slug || !reportId) return json({ ok: false, error: "invalid_payload" }, 400);

  const profile = await getProfile(env, slug);
  if (!profile) return json({ ok: false, error: "profile_not_found" }, 404);
  if (profile.owner_account !== normalizeAccountFromSession(user)) {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  await resolveReport(env, reportId);
  return json({ ok: true });
}

function slugify(text) {
  return String(text || "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "");
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
