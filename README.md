# whitecode

Strona wspiera:
- logowanie Discord (`/auth/*`),
- formularz kontaktowy (`POST /contact`),
- system opini dla zalogowanych użytkowników (`POST /review`, `GET /reviews`).

## System opini (D1 + fallback JSON)

W środowisku Cloudflare (Pages/Workers) opinie są zapisywane trwale do bazy D1.

Jeśli binding D1 nie jest dostępny, kod przełącza się na fallback JSON (runtime Node) lub pamięć procesu.

### Endpointy
- `GET /db/init` — przygotowuje strukturę storage (D1 albo JSON fallback) i zwraca status.
- `POST /review` — dodaje opinię zalogowanego użytkownika (nick + ID pobrane z Discord sesji).
- `GET /reviews` — zwraca najnowsze opinie.

### Struktura danych
Tabela D1: `reviews`.

Fallback JSON (runtime Node): domyślny plik `data/reviews-db.json`.

Przykładowy kształt:
```json
{
  "meta": { "version": 1, "created_at": "...", "updated_at": "..." },
  "tables": {
    "reviews": [
      {
        "id": "rvw_...",
        "created_at": "...",
        "discord_user_id": "123...",
        "discord_user_display": "Nick",
        "review": "Treść opinii",
        "rating": 5
      }
    ]
  }
}
```

### Konfiguracja
- `DB` — zalecany binding D1 (Cloudflare).
- opcjonalnie `D1_BINDING_NAME` — nazwa bindingu D1, jeśli inna niż `DB`.
- opcjonalnie `REVIEWS_JSON_FILE` — własna ścieżka pliku JSON (fallback Node).

## Kontakt i anty-spam
- cooldown: 45s między wiadomościami,
- max 5 wiadomości / 10 minut,
- przy limicie backend zwraca `429` i `retry_after_sec`.
