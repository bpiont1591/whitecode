# whitecode

System opini zapisuje dane tylko do jednej tabeli: `reviews`.

## Gdzie trafiają opinie

Opinie z formularza strony (`POST /review`) są zapisywane do:
- `reviews(created_at, discord_user_id, discord_user_display, review, rating)`

Odczyt na stronę idzie z:
- `GET /reviews`

## Tryby działania

1. **Cloudflare D1 (produkcyjnie)**
   - jeśli jest podpięte D1 w Functions, backend automatycznie tworzy i migruje tabelę `reviews`.
   - preferowany binding: `DB`.
   - można też użyć własnej nazwy bindingu przez `D1_BINDING_NAME`.

2. **Fallback lokalny (Node)**
   - jeśli nie ma D1, dane idą do pliku `data/profiles-db.json`.

3. **Fallback pamięciowy**
   - gdy brak D1 i brak dostępu do pliku, działa pamięć procesu (`MEM_DB`).

## Endpoint init

- `GET /db/init`
  - zwraca błąd, jeśli runtime nie widzi D1,
  - zwraca sukces tylko gdy tabela `reviews` jest potwierdzona.

## Wymagane sekrety

- `SESSION_SECRET`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`
- `DISCORD_WEBHOOK_URL`

## SQL (Cloudflare D1)

Pełny minimalny schemat jest w `schema.sql`.
