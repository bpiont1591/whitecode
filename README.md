# whitecode

## Wymagane sekrety (Cloudflare Pages Functions)
Aby formularz działał tylko po logowaniu Discord OAuth i wysyłał dane użytkownika, ustaw:

- `DISCORD_WEBHOOK_URL` – webhook kanału docelowego
- `DISCORD_CLIENT_ID` – OAuth2 Client ID aplikacji Discord
- `DISCORD_CLIENT_SECRET` – OAuth2 Client Secret aplikacji Discord
- `DISCORD_REDIRECT_URI` – np. `https://whitecode.pl/auth/discord/callback`
- `SESSION_SECRET` – długi losowy sekret do podpisywania sesji cookie

## Endpointy auth
- `GET /auth/discord/start`
- `GET /auth/discord/callback`
- `GET /auth/me`
- `POST /auth/logout`
- `GET /reviews`

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


## Opinie bez bazy danych (tryb uproszczony)
Opinie są dodawane bezpośrednio przez API `/review` i trzymane w pamięci runtime (`/reviews`) bez zapisu do D1.

Uwaga: po restarcie instancji lub nowym deployu lista opinii może się wyzerować.


## Oceny opinii i widoczność na stronie
- Formularz opinii wymaga wyboru oceny 1-5 gwiazdek.
- Endpoint `POST /review` zwraca opinię i dodaje ją do listy w pamięci runtime.
- Endpoint `GET /reviews` zwraca najnowsze opinie, które są renderowane na stronie w sekcji Opinie.
