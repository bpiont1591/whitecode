import { readSessionUser } from "../../_lib/auth.js";
import { normalizeAccountFromSession, setBlockedAccount } from "../../_lib/db.js";

export async function onRequestPost({ request, env }) {
  const user = await readSessionUser(request, env);
  if (!isAdmin(user, env)) return json({ ok: false, error: "forbidden" }, 403);

  const data = await request.json().catch(() => ({}));
  const account = String(data.account || "").trim();
  const blocked = Boolean(data.blocked);
  if (!account) return json({ ok: false, error: "invalid_account" }, 400);

  await setBlockedAccount(env, { account, blocked, reason: String(data.reason || "").trim().slice(0, 300) });
  return json({ ok: true });
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
