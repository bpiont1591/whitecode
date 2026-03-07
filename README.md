# whitecode

Strona działa bez systemu opini. Aktywne są:
- logowanie Discord (`/auth/*`),
- formularz kontaktowy (`POST /contact`).

## Ulepszenia wdrożone

- **SEO technical**: rozbudowane metadane social (`og:image:*`, `twitter:image:alt`, `theme-color`) w `index.html`.
- **UX formularza**: stan wysyłki (`Wysyłam...`), disable pól i przycisku podczas requestu.
- **Anty-spam backend**: rate-limit w `functions/contact.js`:
  - cooldown 45s między wiadomościami,
  - limit 5 wiadomości / 10 minut,
  - odpowiedź `429` z `retry_after_sec`.
