#!/usr/bin/env node
/* Wandelt Exporte des alten Charakter-Editors (JSON, oft als .txt) in das Format
   der Charakterbogen-Seite um.
   Aufruf: node convert_character.js <Zielordner> <datei.txt> [weitere ...]
   Pro Charakter entsteht <Zielordner>/<name_als_slug>.json */
const fs = require("fs"), path = require("path");

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const txt = (v) => (typeof v === "string" ? v.trim() : "");
const nichtLeer = (s) => s && s.toLowerCase() !== "keine";
const zahl = (n) => num(n).toLocaleString("de-DE");

/* Fertigkeiten (Werte sind im Export bereits Endwerte):
   Primär   = Wert >= 40, oder Berufsfertigkeit mit Wert >= 30
   Sekundär = Wert >= 20, sowie immer Muttersprache und Finanzkraft
   Standard = alles andere
   Sortierung je Kategorie: Wert absteigend, dann Name. Doppelte Namen: letzter gewinnt. */
function fertigkeiten(src) {
  const beruf = new Set((src.job?.fertigkeiten || []).map((s) => s[0]));
  const alle = new Map();
  for (const [name, wert] of src.skills || []) alle.set(name, num(wert));
  const kat = { primaer: [], sekundaer: [], standard: [] };
  for (const [name, wert] of alle) {
    const k = name === "Muttersprache" || name === "Finanzkraft" ? "sekundaer"
      : wert >= 40 || (beruf.has(name) && wert >= 30) ? "primaer"
      : wert >= 20 ? "sekundaer" : "standard";
    kat[k].push({ name, wert });
  }
  for (const l of Object.values(kat))
    l.sort((a, b) => b.wert - a.wert || a.name.localeCompare(b.name, "de", { sensitivity: "base" }));
  return kat;
}

function waffen(src) {
  const felder = [["weapon-skill", "Fertigkeit"], ["weapon-chance", "Chance"], ["weapon-dmg", "Schaden"],
    ["weapon-range", "Reichweite"], ["weapon-attacks", "Angriffe"], ["weapon-shots", "Schuss"], ["weapon-fail", "Patzer"]];
  return Object.values(src.weapons || {}).filter((w) => txt(w["weapon-name"])).map((w) => {
    const teile = felder.filter(([k]) => txt(w[k])).map(([k, l]) => `${l} ${txt(w[k])}`);
    return `Waffe: ${txt(w["weapon-name"])}` + (teile.length ? ` (${teile.join(", ")})` : "");
  });
}

/* Texte unverändert übernehmen (keine Rechtschreibkorrektur); leere Felder und "Keine" entfallen */
function freitext(src) {
  const bg = src.background || {}, g = src.general || {}, f = src.finances || {};
  const o = src.otherStats || {}, b = src.baseStats || {};
  const absatz = (label, v) => (nichtLeer(txt(v)) ? (label ? `${label}: ` : "") + txt(v) : null);

  const inventar = [txt(bg.equipment), ...waffen(src)].filter(Boolean).join("\n");
  const besitz = [
    f.barschaft !== undefined ? `Barschaft: ${zahl(f.barschaft)} $` : null,
    f.geldanlagen !== undefined ? `Geldanlagen: ${zahl(f.geldanlagen)} $` : null,
    absatz("Wichtige Besitztümer", bg.vistuff),
    absatz("Artefakte", bg.artifacts)
  ].filter(Boolean).join("\n");
  const herkunft = [["Geboren", g.birthdate], ["Wohnort", g.city], ["Herkunft", g.origin]]
    .filter(([, v]) => txt(v)).map(([l, v]) => `${l}: ${txt(v)}`).join(" · ");
  const werte = [["Körpergröße", b.körpergröße], ["Bewegungsweite", o.bewegungsweite],
    ["Schadensbonus", o.bonusSchaden], ["Statur", o.statur], ["Schmerzgrenze", f.schmerzgreze]]
    .filter(([, v]) => v !== undefined && v !== "").map(([l, v]) => `${l} ${v}`).join(" · ");
  const charakter = [
    absatz("", bg.being), absatz("", bg.description), absatz("Glaube", bg.faith),
    absatz("Verletzungen", bg.injuries), absatz("Phobien/Manien", bg.phobias),
    absatz("Wichtige Personen", bg.vipersons), absatz("Bedeutsame Orte", bg.viplaces),
    absatz("Kontakte", src.job?.kontakte), herkunft || null, werte ? `Weitere Werte: ${werte}` : null
  ].filter(Boolean).join("\n\n");

  return { inventar, besitz, magie: absatz("", bg.cthulhu) || "", charaktereigenschaften: charakter };
}

function convert(src) {
  const b = src.baseStats || {};
  return {
    charakter: { name: txt(src.general?.name), spieler: txt(src.general?.played), beruf: txt(src.job?.job), alter: num(b.alter) },
    /* Erscheinung -> Charisma, Mana -> Magie */
    eigenschaften: { staerke: num(b.stärke), geschicklichkeit: num(b.geschicklichkeit), konstitution: num(b.konstitution),
      charisma: num(b.erscheinung), bildung: num(b.bildung), intelligenz: num(b.intelligenz), magie: num(b.mana) },
    /* HP/Mana = Maximalwerte, Glück/Stabilität = Startwerte (im Bogen editierbar) */
    status: { hp: num(src.otherStats?.trefferpunkte), mana: num(src.otherStats?.magiepunkte),
      glueck: num(b.glück), stabilitaet: num(src.otherStats?.stabilität) },
    fertigkeiten: fertigkeiten(src),
    freitext: freitext(src),
    entwicklung: []
  };
}

const slug = (s) => s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
  .replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "charakter";

if (require.main === module) {
  const [ziel, ...dateien] = process.argv.slice(2);
  if (!ziel || !dateien.length) { console.error("Aufruf: node convert_character.js <Zielordner> <datei.txt> ..."); process.exit(1); }
  fs.mkdirSync(ziel, { recursive: true });
  for (const d of dateien) {
    const out = convert(JSON.parse(fs.readFileSync(d, "utf8")));
    /* Fertigkeiten einzeilig: { "name": "...", "wert": 50 } */
    const json = JSON.stringify(out, null, 2)
      .replace(/\{\n\s+"name": ("(?:[^"\\]|\\.)*"),\n\s+"wert": (\d+)\n\s+\}/g, '{ "name": $1, "wert": $2 }') + "\n";
    const datei = path.join(ziel, slug(out.charakter.name) + ".json");
    fs.writeFileSync(datei, json);
    console.log(`${d} -> ${datei}`);
  }
}
module.exports = { convert, slug };
