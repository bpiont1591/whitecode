# whitecode

## Wymagane sekrety (Cloudflare Pages Functions)
Aby formularz działał tylko po logowaniu Discord OAuth i wysyłał dane użytkownika, ustaw:

- `DISCORD_WEBHOOK_URL` – webhook kanału docelowego
- `DISCORD_CLIENT_ID` – OAuth2 Client ID aplikacji Discord
- `DISCORD_CLIENT_SECRET` – OAuth2 Client Secret aplikacji Discord
- `DISCORD_REDIRECT_URI` – np. `https://whitecode.pl/auth/discord/callback`
- `SESSION_SECRET` – długi losowy sekret do podpisywania sesji cookie
- `D1_BINDING_NAME` – *(opcjonalnie)* nazwa bindingu D1, jeśli nie używasz standardowej nazwy `DB`
- `D1_BINDING_CANDIDATES` – *(opcjonalnie)* lista nazw bindingów D1 rozdzielona przecinkami (np. `MY_DB,PROD_DB`)
- `D1_DATABASE_ID` – *(opcjonalnie)* ID bazy D1 do fallbacku przez Cloudflare API (gdy binding nie działa)
- `CF_ACCOUNT_ID` lub `CLOUDFLARE_ACCOUNT_ID` – konto Cloudflare dla fallbacku API
- `CF_API_TOKEN` lub `CLOUDFLARE_API_TOKEN` – token API z uprawnieniami D1 (Edit)

## Endpointy auth
- `GET /auth/discord/start`
- `GET /auth/discord/callback`
- `GET /auth/me`
- `POST /auth/logout`
- `GET /reviews`
- `GET /db/init`

## Ustawienia Discord OAuth
W panelu Discord Developer Portal:
1. Dodaj Redirect URI identyczny z `DISCORD_REDIRECT_URI`.
2. Scope: `identify`.

## SEO i bezpieczeństwo (wdrożone)
- `robots.txt` i `sitemap.xml` dla lepszego indeksowania Google.
- Meta tagi SEO + OpenGraph + Twitter Cards + JSON-LD w `index.html`.
- Globalne nagłówki bezpieczeństwa w pliku `_headers` (CSP, HSTS, XFO, nosniff itd.).
- Dodatkowa walidacja backendu formularza:
  - sprawdzanie `Origin` / `Referer`,
  - wymóg `Content-Type: application/json`,
  - whitelista tematów formularza.


## Ograniczenie dodawania opinii po roli Discord
Dodany endpoint `POST /review` wymaga zalogowanego użytkownika Discord.

Ograniczenie po roli Discord jest opcjonalne:
- ustaw `REVIEWER_ROLE_ID`, aby wymusić konkretną rolę,
- wtedy wymagane są też `DISCORD_GUILD_ID` i `DISCORD_BOT_TOKEN` do weryfikacji przez Discord API.

Opcjonalnie możesz ustawić osobny webhook dla opinii:
- `REVIEW_WEBHOOK_URL` (fallback: `DISCORD_WEBHOOK_URL`).


## Trwałość opinii (zalecane D1)
Opinie są zapisywane trwale do D1 (preferowana tabela `reviews_v2`, kompatybilnie także `reviews`).

Fallback: jeśli D1 jest chwilowo niedostępne, API może tymczasowo pokazać ostatnie opinie z pamięci runtime.

`GET /db/init` wykonuje:
- inicjalizację/migracje schematu,
- utworzenie i weryfikację tabel (`reviews`, `reviews_v2`),
- healthcheck write-read-delete na ścieżce zapisu opinii.


## Oceny opinii i widoczność na stronie
- Formularz opinii wymaga wyboru oceny 1-5 gwiazdek.
- Endpoint `POST /review` zapisuje opinię do D1 (z fallbackiem pamięci runtime przy awarii D1).
- Endpoint `GET /reviews` zwraca najnowsze opinie, które są renderowane na stronie w sekcji Opinie.
