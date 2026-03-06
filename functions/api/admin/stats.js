import { readSessionUser } from "../../_lib/auth.js";
import { getAdminStats, normalizeAccountFromSession } from "../../_lib/db.js";

export async function onRequestGet({ request, env }) {
  const user = await readSessionUser(request, env);
  if (!isAdmin(user, env)) return json({ ok: false, error: "forbidden" }, 403);

  const stats = await getAdminStats(env);
  return json({ ok: true, stats });
}

function isAdmin(user, env) {
  if (!user) return false;
  const account = normalizeAccountFromSession(user);
  const admin = String(env.ADMIN_ACCOUNT || "dc_1418289596457812088");
  return account === admin;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
