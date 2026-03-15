import { base64url, createOauthStateCookie, randomNonce } from "../../_lib/auth.js";

function sanitizeReturnTo(value) {
  const candidate = String(value || "").trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return "/#kontakt";
  }
  return candidate;
}

export async function onRequestGet({ request, env }) {
  const clientId = env.DISCORD_CLIENT_ID;
  const redirectUri = env.DISCORD_REDIRECT_URI;

  if (!clientId || !redirectUri || !env.SESSION_SECRET) {
    return new Response("Brak konfiguracji OAuth (DISCORD_CLIENT_ID / DISCORD_REDIRECT_URI / SESSION_SECRET)", { status: 500 });
  }

  const nonce = randomNonce();
  const stateObj = {
    t: Date.now(),
    nonce,
    returnTo: sanitizeReturnTo(new URL(request.url).searchParams.get("returnTo"))
  };
  const state = base64url(JSON.stringify(stateObj));
  const stateCookie = await createOauthStateCookie(nonce, env);

  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "consent");

  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      "Set-Cookie": stateCookie
    }
  });
}
