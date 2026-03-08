# whitecode

## Opinie z bazy danych (Cloudflare Pages + D1)

Dodany został endpoint `functions/reviews.js`:
- `GET /reviews` – zwraca widoczne opinie z bazy.
- `POST /reviews` – zapisuje nową opinię do bazy.

### 1) Utwórz bazę D1 i tabelę

Wykonaj SQL z pliku `db/schema.sql`.

### 2) Podepnij binding DB

W Cloudflare Pages dodaj binding D1 o nazwie:

`DB`

Ten binding jest używany w `functions/reviews.js`.

### 3) Efekt

Sekcja `#opinie` na stronie:
- ładuje opinie dynamicznie z `/reviews`,
- pozwala dodać nową opinię przez formularz,
- po zapisie odświeża listę opinii bez przeładowania strony.
