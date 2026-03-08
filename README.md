# whitecode

Strona wspiera:
- logowanie Discord (`/auth/*`),
- formularz kontaktowy (`POST /contact`),
- system opini dla zalogowanych użytkowników (`POST /review`, `GET /reviews`).

## System opini (JSON)

Opinie są zapisywane do JSON i struktura tworzy się automatycznie przy pierwszym użyciu.

### Endpointy
- `GET /db/init` — tworzy/uzupełnia strukturę JSON (`tables.reviews`) i zwraca status.
- `POST /review` — dodaje opinię zalogowanego użytkownika (nick + ID pobrane z Discord sesji).
- `GET /reviews` — zwraca najnowsze opinie.

### Struktura danych
Domyślny plik: `data/reviews-db.json` (w runtime Node).

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
- opcjonalnie `REVIEWS_JSON_FILE` — własna ścieżka pliku JSON.

## Kontakt i anty-spam
- cooldown: 45s między wiadomościami,
- max 5 wiadomości / 10 minut,
- przy limicie backend zwraca `429` i `retry_after_sec`.
