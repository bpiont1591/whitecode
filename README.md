# whitecode

Strona wspiera:
- logowanie Discord (`/auth/*`),
- formularz kontaktowy (`POST /contact`).

System opinii został całkowicie wyłączony i nie jest używany na stronie ani w API.

## Kontakt i anty-spam
- cooldown: 45s między wiadomościami,
- max 5 wiadomości / 10 minut,
- przy limicie backend zwraca `429` i `retry_after_sec`.
