import { base64url } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const clientId = env.DISCORD_CLIENT_ID;
  const redirectUri = env.DISCORD_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return new Response("Brak konfiguracji OAuth (DISCORD_CLIENT_ID / DISCORD_REDIRECT_URI)", { status: 500 });
  }

  const stateObj = {
    t: Date.now(),
    returnTo: new URL(request.url).searchParams.get("returnTo") || "/#kontakt"
  };
  const state = base64url(JSON.stringify(stateObj));

  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "consent");

  return Response.redirect(url.toString(), 302);
}
