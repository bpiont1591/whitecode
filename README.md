# whitecode

System opini zapisuje dane tylko do jednej tabeli: `reviews`.

## Gdzie trafiają opinie

Opinie z formularza strony (`POST /review`) są zapisywane do:
- `reviews(created_at, discord_user_id, discord_user_display, review, rating)`

Odczyt na stronę idzie z:
- `GET /reviews`

## Tryby działania

1. **Cloudflare D1 (produkcyjnie)**
   - jeśli jest podpięte `env.DB`, backend automatycznie tworzy tabelę `reviews`.

2. **Fallback lokalny (Node)**
   - jeśli nie ma `env.DB`, dane idą do pliku `data/profiles-db.json`.

3. **Fallback pamięciowy**
   - gdy brak D1 i brak dostępu do pliku, działa pamięć procesu (`MEM_DB`).

## Endpoint init

- `GET /db/init` przygotowuje storage i potwierdza, że używana jest tylko tabela `reviews`.

## Wymagane sekrety

- `SESSION_SECRET`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`
- `DISCORD_WEBHOOK_URL`

## SQL (Cloudflare D1)

Pełny minimalny schemat jest w `schema.sql`.
