# whitecode

Aktualna wersja używa **bazy D1** do opinii (bez starego systemu `/review` i proxy do bota).

## Endpointy opinii
- `GET /api/opinions` – lista ostatnich 30 opinii
- `POST /api/opinions` – dodanie opinii (wymaga logowania Discord i rangi `✨Klient` o ID `1448144394426388622`); `user_id` i `user_tag` są zapisywane wyłącznie z sesji OAuth po stronie serwera

## Konfiguracja bazy (Cloudflare D1)
1. Utwórz bazę D1 i podepnij binding o nazwie **`DB`** do Pages Functions.
2. Wklej SQL z pliku `db/opinions.sql` i uruchom go w D1.

To SQL tworzy tabelę i dodaje **jedną testową opinię**, więc po wdrożeniu będzie od razu widoczna na stronie.

## SQL do wklejenia
```sql
CREATE TABLE IF NOT EXISTS opinions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  user_tag TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  atmosfera TEXT NOT NULL,
  przebieg TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_opinions_created_at ON opinions(created_at DESC);

INSERT INTO opinions (user_id, user_tag, rating, atmosfera, przebieg, text)
SELECT
  '123456789012345678',
  'Testowy Klient',
  5,
  'Bardzo dobra komunikacja',
  'Szybko, terminowo i profesjonalnie',
  'Współpraca przebiegła świetnie. Polecam WH!TEcode!'
WHERE NOT EXISTS (SELECT 1 FROM opinions);
```

## Usunięty stary system opinii
- `/review`, `/reviews`, `/opinions` zwracają `410 Gone`.
- Frontend używa tylko `/api/opinions`.


## Wymagane zmienne środowiskowe dla opinii
- `DB` (binding D1)
- `DISCORD_GUILD_ID`
- `DISCORD_BOT_TOKEN`

Bez `DISCORD_GUILD_ID` i `DISCORD_BOT_TOKEN` backend nie może zweryfikować rangi `✨Klient` podczas `POST /api/opinions`.
