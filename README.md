# Preventivo Rapido Antizanzare – OMPRA

PWA separata per il preventivo al volo degli impianti antizanzare (Stocker, Zanzero, Gardheaven).
Solo personale OMPRA: login con l'account dell'app OMPRA (Supabase `eoswkplehhmtxtattsha`).

## Da dove prende i dati
- `az_catalogo_pubblicato` — copia del catalogo del modulo antizanzare, **senza costi né sconti**.
  La scrive l'app OMPRA quando apri il modulo antizanzare e il catalogo è cambiato.
- Offline usa l'ultima copia scaricata; al primo avvio senza rete usa `catalogo-riserva.json`.

## Regole (concordate 03/10/2026) — in `calcolo.js`, oggetto `REGOLE`
- 1 ugello ogni 4 m (raffrescamento 1,5 m); area → perimetro = 4 × √mq
- tubo = perimetro + 10 m per circuito
- installazione e collaudo = 250 € + 30 € × ugelli (dal 04/10/2026)
- Zanzero DUAL 2 uscite = DUAL + 286,89 € (350 € IVA incl.)
- forbice ±10%; prodotti prima stagione su 5 mesi con i cicli del modulo antizanzare

## Pubblicazione (GitHub Pages)
Repo `simoneompra-maker/preventivo-antizanzare` → Settings → Pages → Branch `main` / root.
