import { readSessionUser } from "../_lib/auth.js";
import { getProfileByOwner, normalizeAccountFromSession } from "../_lib/db.js";

export async function onRequestGet({ request, env }) {
  const user = await readSessionUser(request, env);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);

  const slug = await getProfileByOwner(env, normalizeAccountFromSession(user));
  return json({ ok: true, slug: slug || null });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
