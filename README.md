# 🍀 10eLotto ogni 5 minuti

App semplicissima, con numeri grandi, per vedere le estrazioni del **10eLotto ogni 5 minuti**:
l'ultima uscita e tutte quelle precedenti, scorrendo con le frecce **◀ PRIMA** e **DOPO ▶**.

- Si apre direttamente sull'**ultima estrazione** e si aggiorna da sola ogni minuto.
- I 20 numeri sono in verde, il **numero Oro** in giallo, il **Doppio Oro** in arancione, sotto i **numeri Extra**.
- Il tasto rosso **ULTIMA** riporta subito all'estrazione più recente.

## Come funziona
Un'automazione di GitHub (`.github/workflows/estrazioni.yml`) gira di continuo: ogni 5 minuti
scarica i numeri (`scripts/aggiorna.mjs`) da 10elotto5minuti.com, con 10elottoogni5minuti.it come riserva.
Poi pubblica l'app su GitHub Pages insieme allo storico (`dati/AAAA-MM-GG.json`, ultimi 120 giorni).
Al primo avvio lo storico parte dagli ultimi 3 giorni e poi cresce da solo.

## Da fare una volta sola
1. GitHub → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Scheda **Actions** → **Aggiorna estrazioni** → **Run workflow**.
3. Dopo un paio di minuti l'app è su `https://tommylangiano.github.io/10elotto/`.

## Metterla sul telefono
- **Android (Chrome)**: menu ⋮ → **Aggiungi a schermata Home**.
- **iPhone (Safari)**: tasto Condividi → **Aggiungi alla schermata Home**.
