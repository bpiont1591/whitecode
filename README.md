# whitecode

Strona wspiera:
- logowanie Discord (`/auth/*`) z walidacją OAuth state + nonce,
- formularz kontaktowy (`POST /contact`) z ochroną anty-spam,
- publiczny widget statusu Discord (`GET /discord/status`) z cache.

System opinii został całkowicie wyłączony i nie jest używany na stronie ani w API.

## Status Discord na stronie
Frontend cyklicznie pobiera `GET /discord/status` i pokazuje:
- liczbę członków serwera,
- liczbę online,
- status bota Whitecode (`online` / `offline` / `unknown`).

### Wymagane zmienne środowiskowe
- `DISCORD_GUILD_ID` — ID serwera Discord.
- `DISCORD_BOT_TOKEN` — token bota (Bot Token).
- `DISCORD_BOT_USER_ID` — ID użytkownika bota (opcjonalnie, dla dokładnego statusu bota w widget API).

Jeśli Discord API chwilowo nie odpowiada, endpoint zwraca ostatnią wartość z cache (`stale: true`).

## Kontakt i anty-spam
- cooldown: 45s między wiadomościami,
- max 5 wiadomości / 10 minut,
- przy limicie backend zwraca `429` i `retry_after_sec`.
