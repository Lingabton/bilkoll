# Bilkoll — Learnings

## Session 1 (2026-03-30/31)

### Prices must be verified
- Never guess car prices from memory — they're often wrong by 50-150k
- Skatteverket SKVFS has official nybilspriser as CSV: `/Users/gabriellinton/Downloads/SKVFS 2025_29.csv`
- Volvo XC60 no longer sold as pure bensin in 2026 — only laddhybrid
- Tesla Model 3 LR AWD: 584 900 (not 449 900 as I had)
- Kia Niro EV and EV6 missing from SKV list — need manual verification

### Scraper quality
- AutoUncle shows max 25 listings per page
- Initial scraper only got 3 per page (didn't handle non-breaking spaces `\xa0`)
- Need to scroll multiple times to load all visible listings
- For full data: pagination needed (not implemented yet)
- Prices with few data points (<10) should be flagged prominently

### Design
- Dark mode was too dark, hard to read on regular screens
- Gabriel prefers light themes for consumer-facing tools
- "Designen behöver bli mycket mycket bättre" — design is a priority, not an afterthought
- Premium look wanted: think Linear/Stripe/Vercel level

### Nypris vs begagnat: variantproblemet
- AutoUncle blandar ALLA varianter av en modell (Active, Style, Executive etc.)
- Om vi sätter nypris = billigaste varianten, ser det ut som att bilen ÖKAR i värde
- Lösning: sätt nypris till median-utrustningsnivån som matchar begagnatmixen
- Beror på modell: RAV4 har 8 varianter (460k–627k), XC60 har 15 (570k–893k)
- Kontrollera alltid: nypris > median begagnatpris för nyaste årsmodellen

### Kostnadsfördelning
- Visa alltid BÅDE per månad OCH totalt — "189 858 kr" utan kontext är meningslöst
- Ange alltid perioden ("totalt 4 år") i rubriken

### Architecture
- TCO recalculation must happen client-side for instant slider response
- Pre-computed data in JSON files, loaded at startup
- Skatteverket bilförmån API exists but uses session cookies — can't call directly
- Skatteverket SKVFS CSV is the gold standard for new car prices (2834 models)
