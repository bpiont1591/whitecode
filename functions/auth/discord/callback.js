import { createSessionCookie, base64urlDecode } from "../../_lib/auth.js";

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
    const cookie = await createSessionCookie(user, env);

    let returnTo = "/#kontakt";
    try {
      const stateObj = JSON.parse(base64urlDecode(state));
      if (stateObj?.returnTo && String(stateObj.returnTo).startsWith("/")) returnTo = stateObj.returnTo;
    } catch {}

    return new Response(null, {
      status: 302,
      headers: {
        Location: returnTo,
        "Set-Cookie": cookie
      }
    });
  } catch {
    return new Response("Błąd logowania OAuth.", { status: 500 });
  }
}
