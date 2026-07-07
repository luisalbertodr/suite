import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

const root = process.env.STYLE_ROOT ?? "C:\\Duna\\Style-Suite-Test";

function tailPlaninc(n: number) {
  const p = [path.join(root, "dbf/planinc.dbf"), path.join(root, "planinc.dbf")].find(fs.existsSync);
  if (!p) return console.log("no planinc");
  const buf = fs.readFileSync(p);
  let off = 32;
  const fields: { name: string; pos: number; flen: number }[] = [];
  let pos = 1;
  while (buf[off] !== 0x0d) {
    fields.push({
      name: buf.slice(off, off + 11).toString("ascii").replace(/\0/g, "").trim().toLowerCase(),
      pos,
      flen: buf[off + 16],
    });
    pos += buf[off + 16];
    off += 32;
  }
  const headerLen = buf.readUInt16LE(8);
  const recordLen = buf.readUInt16LE(10);
  const nRecords = buf.readUInt32LE(4);
  const start = Math.max(0, nRecords - n);
  console.log("planinc", p, "records", nRecords, "tail", n);
  for (let i = nRecords - 1; i >= start; i--) {
    const recOff = headerLen + i * recordLen;
    if (buf[recOff] === 0x2a) continue;
    const row: Record<string, string> = {};
    for (const f of fields) {
      const raw = buf.slice(recOff + f.pos, recOff + f.pos + f.flen).toString("ascii").replace(/\0/g, "").trim();
      if (raw) row[f.name] = raw;
    }
    const tip = (row.tipinc ?? row.tip ?? "").toUpperCase();
    if (!["CREAR", "MODIFICAR", "BORRAR"].includes(tip)) continue;
    console.log(JSON.stringify(row));
    if (nRecords - i > 15) break;
  }
}

function findPlan2009(idplan: string) {
  const p = [path.join(root, "dbf/plan2009.dbf"), path.join(root, "plan2009.dbf")].find(fs.existsSync);
  if (!p) return;
  const buf = fs.readFileSync(p);
  let off = 32;
  const fields: { name: string; pos: number; flen: number }[] = [];
  let pos = 1;
  while (buf[off] !== 0x0d) {
    fields.push({
      name: buf.slice(off, off + 11).toString("ascii").replace(/\0/g, "").trim().toLowerCase(),
      pos,
      flen: buf[off + 16],
    });
    pos += buf[off + 16];
    off += 32;
  }
  const headerLen = buf.readUInt16LE(8);
  const recordLen = buf.readUInt16LE(10);
  const nRecords = buf.readUInt32LE(4);
  let hits = 0;
  for (let i = nRecords - 1; i >= 0 && hits < 5; i--) {
    const recOff = headerLen + i * recordLen;
    if (buf[recOff] === 0x2a) continue;
    const row: Record<string, string> = {};
    for (const f of fields) {
      const raw = buf.slice(recOff + f.pos, recOff + f.pos + f.flen).toString("ascii").replace(/\0/g, "").trim();
      if (raw) row[f.name] = raw;
    }
    const txt = (row.texto ?? "").toLowerCase();
    const hor = row.horini ?? "";
    if (txt.includes("style") || hor.startsWith("10:4")) {
      console.log("plan2009 hit:", JSON.stringify({ idplan: row.idplan, fecha: row.fecha, horini: row.horini, texto: row.texto, nomcli: row.nomcli }));
      hits++;
    }
  }
}

tailPlaninc(200);
findPlan2009("");
