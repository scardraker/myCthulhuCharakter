#!/usr/bin/env node
/* Erzeugt charakter/liste.json aus allen .json-Dateien im Ordner „charakter“.
   Aufruf (lokal, im Ordner mit index.html):
     node liste_erzeugen.js              -> liest ./charakter, schreibt ./charakter/liste.json
     node liste_erzeugen.js anderer/ord  -> anderer Ordner
   Die erzeugte liste.json danach zusammen mit den Charakteren hochladen. */
const fs = require("fs"), path = require("path");

const ordner = path.resolve(process.argv[2] || path.join(__dirname, "charakter"));
const ausgabe = path.join(ordner, "liste.json");

if (!fs.existsSync(ordner) || !fs.statSync(ordner).isDirectory()) {
  console.error(`Ordner nicht gefunden: ${ordner}`);
  process.exit(1);
}

const namen = fs.readdirSync(ordner, { withFileTypes: true })
  .filter((d) => d.isFile() && /\.json$/i.test(d.name) && d.name.toLowerCase() !== "liste.json")
  .map((d) => d.name)
  .sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));

/* Dateien, die kein gültiges JSON sind, nicht aufnehmen */
const gueltig = namen.filter((n) => {
  try { JSON.parse(fs.readFileSync(path.join(ordner, n), "utf8")); return true; }
  catch (e) { console.warn(`Übersprungen (kein gültiges JSON): ${n} – ${e.message}`); return false; }
});

fs.writeFileSync(ausgabe, JSON.stringify(gueltig, null, 2) + "\n");
console.log(`${gueltig.length} Charakter(e) in ${ausgabe}:`);
for (const n of gueltig) console.log("  " + n);
