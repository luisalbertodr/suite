import { createHash } from "node:crypto";
import { loadDbfIndexed, dbfFingerprintKey, dbfStr } from "./dist/dbfSource.js";

const fields = ["serie", "serfac", "codcli", "fecha", "fecfac", "totfac", "totimpbas"];
function fp(row) {
  return createHash("sha256")
    .update(fields.map((f) => `${f}=${dbfStr(row, f)}`).join("\x1e"))
    .digest("hex")
    .slice(0, 40);
}

const idx = await loadDbfIndexed("/mnt/style", "faccab", "ejefac");
const byKey = new Map();
let dups = 0;
for (const [k, r] of idx) {
  const mk = dbfFingerprintKey("faccab", k, r);
  if (byKey.has(mk)) dups++;
  else byKey.set(mk, fp(r));
}
console.log("index", idx.size, "unique", byKey.size, "dups", dups);
const entries = [...byKey.keys()];
const chunk = entries.slice(0, 200);
const seen = new Set();
let cd = 0;
for (const k of chunk) {
  if (seen.has(k)) cd++;
  seen.add(k);
}
console.log("chunk0 dup", cd);
