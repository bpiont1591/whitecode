# whitecode

Nowy system opini działa w 3 trybach i nie wymaga ręcznego stawiania tabel przy poprawnym `DB` bindingu.

## Tryby danych

1. **Produkcja (Cloudflare D1)**
   - jeśli dostępne jest `env.DB`, backend automatycznie robi `ensureSchema` (tabele + indeksy),
   - zapis i odczyt idzie SQL-em.

2. **Fallback/dev (in-memory)**
   - jeśli `env.DB` nie istnieje i runtime nie ma dostępu do pliku, działa pamięć procesu (`MEM_DB`).

3. **Lokalny Node (trwały plik JSON)**
   - jeśli brak `env.DB`, ale uruchamiasz w Node, dane zapisują się do `data/profiles-db.json` (lub ścieżki z `LOCAL_DB_FILE`).

## Wymagane sekrety auth/webhook

- `DISCORD_WEBHOOK_URL`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`
- `SESSION_SECRET`

## D1 binding

- ustaw D1 binding jako `DB`.
- opcjonalnie `DEFAULT_PROFILE_SLUG` dla endpointów `/review` i `/reviews`.

## Tabele tworzone automatycznie

- `profiles`
- `reviews`
- `reports`
- `blocked_accounts`
- `message_blocks`

Schemat referencyjny: `schema.sql`.

## API (system profili i opinii)

- `GET /api/profile?user=<slug>`
- `POST /api/profile/create`
- `POST /api/profile/settings`
- `POST /api/profile/delete`
- `GET /api/my-profile`
- `POST /api/review`
- `POST /api/report`
- `POST /api/report/resolve`
- `GET /api/admin/reports`
- `GET /api/admin/stats`
- `POST /api/admin/block`
- `POST /api/admin/report/action`

## Kompatybilność z dotychczasowym landingiem

- `POST /review` (1-5 gwiazdek)
- `GET /reviews`

Te endpointy mapują dane do nowego modelu tabeli `reviews`.

## Smoke test (lokalnie)

Uruchom:

```bash
node tests/smoke-reviews.mjs
```

Test sprawdza sekwencję: create profile → add review → report → resolve → delete profile → recreate.
