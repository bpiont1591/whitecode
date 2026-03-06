# whitecode

## Wymagane sekrety (Cloudflare Pages Functions)
Aby formularz działał tylko po logowaniu Discord OAuth i wysyłał dane użytkownika, ustaw:

- `DISCORD_WEBHOOK_URL` – webhook kanału docelowego
- `DISCORD_CLIENT_ID` – OAuth2 Client ID aplikacji Discord
- `DISCORD_CLIENT_SECRET` – OAuth2 Client Secret aplikacji Discord
- `DISCORD_REDIRECT_URI` – np. `https://whitecode.pl/auth/discord/callback`
- `SESSION_SECRET` – długi losowy sekret do podpisywania sesji cookie
- `D1_BINDING_NAME` – *(opcjonalnie)* nazwa bindingu D1, jeśli nie używasz standardowej nazwy `DB`

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
Dodany endpoint `POST /review` wymaga:
- zalogowanego użytkownika Discord,
- członkostwa w serwerze (`DISCORD_GUILD_ID`),
- posiadania roli recenzenta (`REVIEWER_ROLE_ID`, domyślnie `1448144394426388622`),
- tokenu bota (`DISCORD_BOT_TOKEN`) do weryfikacji ról przez Discord API.

Opcjonalnie możesz ustawić osobny webhook dla opinii:
- `REVIEW_WEBHOOK_URL` (fallback: `DISCORD_WEBHOOK_URL`).


## Trwałość danych (D1) – żeby nic nie znikało
Wdrożona została trwała warstwa zapisu do bazy Cloudflare D1 (preferowany binding `DB`; backend wykrywa też inne poprawne bindingi D1) dla:
- wiadomości kontaktowych (`contact_messages`),
- opinii (`reviews`).

Dane zapisują się nawet jeśli Discord webhook chwilowo zwróci błąd (status webhooka zapisuje się w bazie).

### Co dodać w Cloudflare
1. Utwórz bazę D1.
2. Podepnij binding D1 do Pages Functions (najlepiej nazwa `DB`).
3. Jeśli używasz innej nazwy bindingu, ustaw `D1_BINDING_NAME` na dokładną nazwę bindingu (to najpewniejsza opcja).
4. Endpointy dodatkowo próbują auto-detekcji i testu użycia bindingu D1, ale jeśli masz wiele bindingów D1 ustaw `D1_BINDING_NAME`, żeby jednoznacznie wskazać bazę.
5. Tabele `reviews` i `contact_messages` są tworzone automatycznie przy pierwszym zapisie i dodatkowo weryfikowane po stronie backendu.
6. Strona wykonuje też cichy warmup (`GET /db/init`) przy ładowaniu, aby przygotować tabele wcześniej.
7. Dodatkowo middleware Functions próbuje inicjalizacji schematu przy każdym requestcie (nieblokująco), aby automatycznie odtworzyć tabele po wdrożeniu.
8. (Opcjonalnie) uruchom `schema.sql` ręcznie, jeśli chcesz przygotować schemat z wyprzedzeniem.


## Oceny opinii i widoczność na stronie
- Formularz opinii wymaga wyboru oceny 1-5 gwiazdek.
- Endpoint `POST /review` zapisuje ocenę i treść do D1.
- Endpoint `GET /reviews` zwraca najnowsze opinie, które są renderowane na stronie w sekcji Opinie.
