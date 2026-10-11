// Scarica le estrazioni del 10eLotto ogni 5 minuti e prepara il sito in _site/.
// Lo storico viene ripreso dal sito già pubblicato (BASE_URL) e arricchito con le estrazioni nuove.
//
// Uso:  node scripts/aggiorna.mjs            -> un giro subito
//       node scripts/aggiorna.mjs --attendi  -> aspetta la prossima estrazione, poi un giro
import fs from "node:fs";
import path from "node:path";

const RADICE = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SITO = path.join(RADICE, "_site");
const DATI = path.join(SITO, "dati");
const FILE_APP = ["index.html", "manifest.json", "icon.svg", "sw.js", ".nojekyll"];
const GIORNI_DA_TENERE = 120;
const BASE_URL = (process.env.BASE_URL || "").replace(/\/?$/, "/");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio",
  "agosto", "settembre", "ottobre", "novembre", "dicembre"];

const attendi = (ms) => new Promise((r) => setTimeout(r, ms));
const due = (n) => String(n).padStart(2, "0");

async function scarica(url, { json = false, tentativi = 3 } = {}) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": UA, "Accept-Language": "it-IT,it;q=0.9", "Cache-Control": "no-cache" },
        signal: AbortSignal.timeout(25000),
      });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("HTTP " + r.status);
      return json ? await r.json() : await r.text();
    } catch (e) {
      if (i >= tentativi) throw new Error(url + ": " + e.message);
      await attendi(2000 * i);
    }
  }
}

// ---------- validazione ----------
function valida(e) {
  const ok = (n) => Number.isInteger(n) && n >= 1 && n <= 90;
  return e && /^\d{4}-\d{2}-\d{2}$/.test(e.data) && Number.isInteger(e.n) && e.n >= 1 && e.n <= 288 &&
    e.numeri.length === 20 && new Set(e.numeri).size === 20 && e.numeri.every(ok) &&
    ok(e.oro) && ok(e.doppioOro) && e.numeri.includes(e.oro) && e.numeri.includes(e.doppioOro) &&
    e.extra.every(ok) && e.extra.every((x) => !e.numeri.includes(x));
}

// L'estrazione n. 288 è quella delle 00:00: appartiene al giorno prima.
function giornoDi(data, ora, n) {
  if (ora === "00:00" && n > 1) {
    const d = new Date(data + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }
  return data;
}

// ---------- fonte 1: 10elotto5minuti.com (oggi, ieri, l'altro ieri) ----------
function leggiFonte1(html) {
  const risultati = [];
  const blocchi = html.split('<div class="draw-entry">').slice(1);
  for (const b of blocchi) {
    const t = b.match(/data-date="(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})"[\s\S]*?n\.\s*(\d+)/);
    if (!t) continue;
    const riga = (b.match(/<div class="draw-numbers-row">([\s\S]*?)<\/div>\s*<div class="draw-extra/) || [])[1] || "";
    const numeri = [...riga.matchAll(/class="draw-num[^"]*"[^>]*>\s*(\d{1,2})\s*</g)].map((m) => +m[1]);
    const extraHtml = (b.match(/<div class="draw-extra-nums">([\s\S]*?)<\/div>\s*<div class="draw-oro-block"/) || [])[1] || "";
    const extra = [...extraHtml.matchAll(/<div>\s*(\d{1,2})\s*<\/div>/g)].map((m) => +m[1]);
    const oro = +((b.match(/data-oro="(\d+)"/) || [])[1]);
    const doppioOro = +((b.match(/data-2oro="(\d+)"/) || [])[1]);
    const n = +t[3];
    risultati.push({ data: giornoDi(t[1], t[2], n), n, ora: t[2], numeri: numeri.sort((a, b) => a - b), oro, doppioOro, extra: extra.sort((a, b) => a - b) });
  }
  return risultati;
}

// ---------- fonte 2: 10elottoogni5minuti.it (ultime estrazioni) ----------
function leggiFonte2(html) {
  const testo = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const re = /Estrazione 10eLotto ogni 5 minuti n\. (\d+) di \w+ (\d{1,2}) (\w+) (\d{4}) Numeri estratti 10eLotto ((?:\d{1,2} ){20})Numero Oro (\d{1,2}) Doppio Oro (\d{1,2}) Numeri Extra ((?:\d{1,2} ?){15})/gi;
  const risultati = [];
  for (const m of testo.matchAll(re)) {
    const mese = MESI.indexOf(m[3].toLowerCase()) + 1;
    if (!mese) continue;
    const n = +m[1];
    const minuti = (n * 5) % 1440;
    const ora = due(Math.floor(minuti / 60)) + ":" + due(minuti % 60);
    // Su questo sito l'estrazione delle 00:00 è già intestata al giorno prima.
    risultati.push({
      data: `${m[4]}-${due(mese)}-${due(m[2])}`, n, ora,
      numeri: m[5].trim().split(" ").map(Number).sort((a, b) => a - b),
      oro: +m[6], doppioOro: +m[7],
      extra: m[8].trim().split(" ").map(Number).sort((a, b) => a - b),
    });
  }
  return risultati;
}

const FONTI = [
  { nome: "10elotto5minuti.com oggi", url: "https://10elotto5minuti.com/estrazioni-di-oggi", leggi: leggiFonte1 },
  { nome: "10elotto5minuti.com ieri", url: "https://10elotto5minuti.com/estrazioni-di-ieri", leggi: leggiFonte1, solo: "primo" },
  { nome: "10elotto5minuti.com altro ieri", url: "https://10elotto5minuti.com/estrazioni-dellaltro-ieri", leggi: leggiFonte1, solo: "primo" },
  { nome: "10elottoogni5minuti.it", url: "https://10elottoogni5minuti.it/", leggi: leggiFonte2 },
];

async function raccogli(primoGiro) {
  const tutte = [];
  for (const f of FONTI) {
    if (f.solo === "primo" && !primoGiro) continue;
    try {
      const html = await scarica(f.url);
      const lette = html ? f.leggi(html) : [];
      const buone = lette.filter(valida);
      console.log(`${f.nome}: ${buone.length} estrazioni valide (${lette.length - buone.length} scartate)`);
      tutte.push(...buone);
    } catch (e) {
      console.log(`${f.nome}: ERRORE ${e.message}`);
    }
  }
  return tutte;
}

// ---------- archivio ----------
function leggiLocale() {
  const archivio = new Map();
  if (!fs.existsSync(DATI)) return null;
  for (const f of fs.readdirSync(DATI)) {
    const m = f.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
    if (m) archivio.set(m[1], JSON.parse(fs.readFileSync(path.join(DATI, f), "utf8")).estrazioni);
  }
  return archivio;
}

async function leggiPubblicato() {
  const archivio = new Map();
  if (!BASE_URL || BASE_URL === "/") return archivio;
  const indice = await scarica(BASE_URL + "dati/indice.json?t=" + Date.now(), { json: true });
  if (!indice) { console.log("Nessuno storico pubblicato: si parte da zero."); return archivio; }
  for (const g of indice.giorni) {
    const giorno = await scarica(`${BASE_URL}dati/${g}.json?t=${Date.now()}`, { json: true });
    if (!giorno) throw new Error("Manca il giorno " + g + " sul sito: interrompo per non perdere lo storico");
    archivio.set(g, giorno.estrazioni);
  }
  console.log(`Storico pubblicato: ${archivio.size} giorni.`);
  return archivio;
}

function unisci(archivio, nuove) {
  const cambiati = new Set();
  for (const e of nuove) {
    const lista = archivio.get(e.data) || [];
    if (lista.some((x) => x.n === e.n)) continue;
    const { data, ...resto } = e;
    lista.push(resto);
    lista.sort((a, b) => a.n - b.n);
    archivio.set(e.data, lista);
    cambiati.add(e.data);
  }
  return cambiati;
}

function scrivi(archivio) {
  fs.mkdirSync(DATI, { recursive: true });
  for (const f of FILE_APP) {
    if (fs.existsSync(path.join(RADICE, f))) fs.copyFileSync(path.join(RADICE, f), path.join(SITO, f));
  }
  const giorni = [...archivio.keys()].sort().slice(-GIORNI_DA_TENERE);
  for (const f of fs.readdirSync(DATI)) {
    const m = f.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
    if (m && !giorni.includes(m[1])) fs.unlinkSync(path.join(DATI, f));
  }
  for (const g of giorni) {
    fs.writeFileSync(path.join(DATI, g + ".json"), JSON.stringify({ data: g, estrazioni: archivio.get(g) }));
  }
  const ultimoGiorno = giorni[giorni.length - 1];
  const ultima = ultimoGiorno ? archivio.get(ultimoGiorno).at(-1) : null;
  fs.writeFileSync(path.join(DATI, "indice.json"), JSON.stringify({
    aggiornato: new Date().toISOString(),
    giorni,
    ultima: ultima ? { data: ultimoGiorno, n: ultima.n, ora: ultima.ora } : null,
  }));
  return ultima ? `${ultimoGiorno} n. ${ultima.n}` : "nessuna";
}

function ultimaNota(archivio) {
  const g = [...archivio.keys()].sort().at(-1);
  return g ? g + "#" + archivio.get(g).at(-1).n : "";
}

async function esci(cambiato) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `cambiato=${cambiato}\n`);
}

// ---------- programma ----------
const modoAttesa = process.argv.includes("--attendi");
let archivio = leggiLocale();
const primoGiro = archivio === null;
if (primoGiro) archivio = await leggiPubblicato();

if (modoAttesa) {
  // Le estrazioni escono ogni 5 minuti: aspetto un po' dopo la prossima e riprovo finché compare.
  const prima = ultimaNota(archivio);
  const ora = Date.now();
  const prossima = Math.ceil(ora / 300000) * 300000 + 75000;
  const attesa = Math.min(prossima - ora, 300000);
  console.log(`Attendo ${Math.round(attesa / 1000)} secondi...`);
  await attendi(attesa);
  const fine = Date.now() + 150000;
  let cambiati;
  do {
    cambiati = unisci(archivio, await raccogli(false));
    if (cambiati.size || ultimaNota(archivio) !== prima) break;
    await attendi(30000);
  } while (Date.now() < fine);
  console.log("Ultima estrazione:", scrivi(archivio));
  await esci(cambiati.size > 0);
} else {
  const cambiati = unisci(archivio, await raccogli(true));
  console.log("Giorni aggiornati:", [...cambiati].join(", ") || "nessuno");
  console.log("Ultima estrazione:", scrivi(archivio));
  // Al primo giro pubblico sempre, così anche le modifiche all'app arrivano online.
  await esci(true);
}
