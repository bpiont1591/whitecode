import { readSessionUser } from "../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const user = await readSessionUser(request, env);
  return new Response(JSON.stringify({ ok: true, user: user ? {
    id: user.sub,
    username: user.username,
    global_name: user.global_name,
    discriminator: user.discriminator,
    avatar: user.avatar
  } : null }), {
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
