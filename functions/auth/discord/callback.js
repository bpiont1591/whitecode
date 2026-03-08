import { createSessionCookie, base64urlDecode, clearOauthStateCookie, readOauthStateCookie } from "../../_lib/auth.js";

const OAUTH_MAX_AGE_MS = 10 * 60 * 1000;

export async function onRequestGet({ request, env }) {
  try {
    const u = new URL(request.url);
    const code = u.searchParams.get("code");
    const state = u.searchParams.get("state");

    if (!code || !state) return Response.redirect(new URL('/#kontakt', request.url).toString(), 302);

    const clientId = env.DISCORD_CLIENT_ID;
    const clientSecret = env.DISCORD_CLIENT_SECRET;
    const redirectUri = env.DISCORD_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri || !env.SESSION_SECRET) {
      return new Response("Brak konfiguracji OAuth w środowisku.", { status: 500 });
    }

    let stateObj;
    try {
      stateObj = JSON.parse(base64urlDecode(state));
    } catch {
      return new Response("Nieprawidłowy OAuth state.", { status: 400 });
    }

    const cookieState = await readOauthStateCookie(request, env);
    if (!cookieState || !stateObj?.nonce || cookieState.nonce !== stateObj.nonce) {
      return new Response("Błąd bezpieczeństwa OAuth (state mismatch).", {
        status: 400,
        headers: { "Set-Cookie": clearOauthStateCookie() }
      });
    }

    if (!stateObj?.t || Date.now() - Number(stateObj.t) > OAUTH_MAX_AGE_MS) {
      return new Response("OAuth state wygasł. Spróbuj ponownie.", {
        status: 400,
        headers: { "Set-Cookie": clearOauthStateCookie() }
      });
    }

    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri
      })
    });

    if (!tokenRes.ok) return new Response("Nie udało się zalogować przez Discord.", { status: 502 });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) return new Response("Brak tokena OAuth.", { status: 502 });

    const meRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!meRes.ok) return new Response("Nie udało się pobrać użytkownika Discord.", { status: 502 });

    const user = await meRes.json();
    const sessionCookie = await createSessionCookie(user, env);

    let returnTo = "/#kontakt";
    if (stateObj?.returnTo && String(stateObj.returnTo).startsWith("/")) {
      returnTo = stateObj.returnTo;
    }

    const headers = new Headers({ Location: returnTo });
    headers.append("Set-Cookie", sessionCookie);
    headers.append("Set-Cookie", clearOauthStateCookie());

    return new Response(null, {
      status: 302,
      headers
    });
  } catch {
    return new Response("Błąd logowania OAuth.", { status: 500 });
  }
}
