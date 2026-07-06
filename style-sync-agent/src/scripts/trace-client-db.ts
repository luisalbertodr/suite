/**
 * Rastrea un cliente en toda la base Style-Suite-Test.
 * Uso: npx tsx src/scripts/trace-client-db.ts "Fernanda Piccolini" 2026-07-07
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { dbfDateIso, dbfStr, resolveDbfPath } from "../dbfSource.js";
import { Dbf } from "dbf-reader";

const ROOT = process.env.STYLE_ROOT ?? "C:\\Duna\\Style-Suite-Test";
const CLIENT = (process.argv[2] ?? "Fernanda Piccolini").toLowerCase();
const DATE = process.argv[3] ?? "2026-07-07";

function parseLayout(buf: Buffer) {
  const headerLen = buf.readUInt16LE(8);
  const recordLen = buf.readUInt16LE(10);
  const nRecords = buf.readUInt32LE(4);
  let off = 32;
  const fields: Array<{ name: string; type: string; flen: number; pos: number }> = [];
  let pos = 1;
  while (buf[off] !== 0x0d) {
    const name = buf.slice(off, off + 11).toString("ascii").replace(/\0/g, "").trim();
    const type = String.fromCharCode(buf[off + 11]);
    const flen = buf[off + 16];
    fields.push({ name: name.toUpperCase(), type, flen, pos });
    pos += flen;
    off += 32;
  }
  return { headerLen, recordLen, nRecords, fields };
}

function ymd(buf: Buffer, recOff: number, field: { pos: number; flen: number }) {
  const s = buf.slice(recOff + field.pos, recOff + field.pos + field.flen).toString("ascii").trim().slice(0, 8);
  if (!/^\d{8}$/.test(s)) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function raw(buf: Buffer, recOff: number, field: { pos: number; flen: number }) {
  return buf.slice(recOff + field.pos, recOff + field.pos + field.flen).toString("ascii").trim();
}

function rowText(buf: Buffer, recOff: number, fields: ReturnType<typeof parseLayout>["fields"]) {
  const parts: string[] = [];
  for (const f of fields) {
    const v = raw(buf, recOff, f);
    if (!v) continue;
    if (f.type === "D") {
      const d = ymd(buf, recOff, f);
      parts.push(`${f.name}=${d ?? v}`);
    } else {
      parts.push(`${f.name}=${v.slice(0, 60)}`);
    }
  }
  return parts.join(" | ");
}

function scanDbf(dbfPath: string, table: string) {
  const buf = fs.readFileSync(dbfPath);
  const layout = parseLayout(buf);
  const dt = Dbf.read(buf as unknown as Buffer);
  const nameFields = layout.fields.filter((f) =>
    ["NOMCLI", "NOMCLIX", "NOMBRE", "NOMEMP", "CLIENTE", "TEXTO", "TEXTOX"].includes(f.name),
  );
  const dateFields = layout.fields.filter((f) => f.type === "D" || f.name.includes("FECHA") || f.name === "FECHAX");

  const hits: Array<{ table: string; rec: number; matchIn: string; dates: string; line: string }> = [];
  let ri = 0;
  for (let i = 0; i < layout.nRecords; i++) {
    const recOff = layout.headerLen + i * layout.recordLen;
    if (buf[recOff] === 0x2a) continue;
    const row = dt.rows[ri++] as Record<string, unknown> | undefined;
    if (!row) continue;

    let matchedField = "";
    for (const nf of nameFields) {
      const v = raw(buf, recOff, nf).toLowerCase();
      if (v.includes(CLIENT)) {
        matchedField = nf.name;
        break;
      }
    }
    if (!matchedField) {
      // fallback: any string field
      for (const f of layout.fields) {
        if (f.type !== "C" && f.type !== "M") continue;
        const v = raw(buf, recOff, f).toLowerCase();
        if (v.includes(CLIENT)) {
          matchedField = f.name;
          break;
        }
      }
    }
    if (!matchedField) continue;

    const dates: string[] = [];
    for (const df of dateFields) {
      const iso = ymd(buf, recOff, df);
      if (iso) dates.push(`${df.name}=${iso}`);
    }
    const touchesDate = dates.some((d) => d.includes(DATE));
    hits.push({
      table,
      rec: i + 1,
      matchIn: matchedField,
      dates: dates.join(", ") || "(sin fecha)",
      line: rowText(buf, recOff, layout.fields),
    });
    void touchesDate;
  }
  return hits;
}

console.log("ROOT:", ROOT);
console.log("Cliente:", CLIENT);
console.log("Fecha objetivo:", DATE);
console.log("");

const dbfDir = path.join(ROOT, "dbf");
const dbfFiles = fs.readdirSync(dbfDir).filter((f) => f.toLowerCase().endsWith(".dbf"));
const allHits: Array<{ table: string; rec: number; matchIn: string; dates: string; line: string }> = [];

for (const file of dbfFiles.sort()) {
  const full = path.join(dbfDir, file);
  try {
    const hits = scanDbf(full, file.replace(/\.dbf$/i, ""));
    if (hits.length) {
      allHits.push(...hits);
      console.log(`\n=== ${file} (${hits.length} coincidencias) ===`);
      for (const h of hits) {
        const mark = h.dates.includes(DATE) ? " *** TOCA " + DATE + " ***" : "";
        console.log(`  rec=${h.rec} campo=${h.matchIn}${mark}`);
        console.log(`    ${h.dates}`);
        console.log(`    ${h.line.slice(0, 280)}`);
      }
    }
  } catch (e) {
    console.log(`  [skip ${file}: ${(e as Error).message}]`);
  }
}

// dbfOld
const oldDir = path.join(ROOT, "dbfOld");
if (fs.existsSync(oldDir)) {
  console.log("\n\n######## dbfOld ########");
  for (const file of fs.readdirSync(oldDir).filter((f) => f.toLowerCase().endsWith(".dbf")).sort()) {
    const full = path.join(oldDir, file);
    try {
      const hits = scanDbf(full, "dbfOld/" + file.replace(/\.dbf$/i, ""));
      if (hits.length) {
        console.log(`\n=== dbfOld/${file} (${hits.length}) ===`);
        for (const h of hits.slice(0, 15)) {
          console.log(`  rec=${h.rec} ${h.dates} | ${h.line.slice(0, 200)}`);
        }
      }
    } catch {
      /* skip */
    }
  }
}

// sync archive json
const syncDir = path.join(ROOT, "sync");
if (fs.existsSync(syncDir)) {
  console.log("\n\n######## sync JSON ########");
  const jsons: string[] = [];
  function walk(d: string) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".json")) jsons.push(p);
    }
  }
  walk(syncDir);
  for (const j of jsons) {
    const t = fs.readFileSync(j, "utf8");
    if (!t.toLowerCase().includes(CLIENT.split(" ")[0])) continue;
    if (DATE && !t.includes(DATE)) continue;
    console.log("\n", j);
    console.log(t.slice(0, 500));
  }
}

// cola_sincro
const cola = resolveDbfPath(ROOT, "cola_sincro");
if (cola) {
  console.log("\n\n######## cola_sincro ########");
  const hits = scanDbf(cola, "cola_sincro");
  const f = hits.filter((h) => h.line.toLowerCase().includes(CLIENT));
  console.log("coincidencias:", f.length);
  for (const h of f.slice(0, 20)) console.log(h.line.slice(0, 200));
}

console.log("\n\n======== RESUMEN ========");
console.log("Total tablas con coincidencias:", new Set(allHits.map((h) => h.table)).size);
console.log("Total filas:", allHits.length);
const jul7 = allHits.filter((h) => h.dates.includes(DATE));
console.log(`Filas que tocan ${DATE}:`, jul7.length);
for (const h of jul7) {
  console.log(`  ${h.table} rec=${h.rec} campo=${h.matchIn}`);
  console.log(`    ${h.line.slice(0, 300)}`);
}
