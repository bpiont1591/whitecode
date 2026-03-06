# whitecode

## Wymagane sekrety (Cloudflare Pages Functions)
Aby formularz działał tylko po logowaniu Discord OAuth i wysyłał dane użytkownika, ustaw:

- `DISCORD_WEBHOOK_URL` – webhook kanału docelowego
- `DISCORD_CLIENT_ID` – OAuth2 Client ID aplikacji Discord
- `DISCORD_CLIENT_SECRET` – OAuth2 Client Secret aplikacji Discord
- `DISCORD_REDIRECT_URI` – np. `https://twoja-domena.pl/auth/discord/callback`
- `SESSION_SECRET` – długi losowy sekret do podpisywania sesji cookie

## Endpointy auth
- `GET /auth/discord/start`
- `GET /auth/discord/callback`
- `GET /auth/me`
- `POST /auth/logout`

## Ustawienia Discord OAuth
W panelu Discord Developer Portal:
1. Dodaj Redirect URI identyczny z `DISCORD_REDIRECT_URI`.
2. Scope: `identify`.
