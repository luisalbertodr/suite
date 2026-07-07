#!/bin/bash
set -euo pipefail
ROOT=/mnt/style
for f in "$ROOT/cola_sincro.dbf" "$ROOT/dbf/cola_sincro.dbf" "$ROOT/plan2009.dbf" "$ROOT/dbf/plan2009.dbf"; do
  [ -f "$f" ] && echo "FOUND $f $(stat -c '%y' "$f")"
done

docker exec style-sync-agent node -e "
const fs = require('fs');
const path = require('path');
const { Dbf } = require('dbf-reader');

const ROOT = '/mnt/style';
function find(name) {
  for (const p of [path.join(ROOT, name), path.join(ROOT, 'dbf', name)]) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function readDbf(file) {
  const buf = fs.readFileSync(file);
  const dt = Dbf.read(buf);
  return dt.rows.map(r => {
    const o = {};
    for (const k of Object.keys(r)) o[k.toLowerCase()] = r[k];
    return o;
  });
}

const colaPath = find('cola_sincro.dbf');
if (colaPath) {
  const rows = readDbf(colaPath).filter(r => String(r.tabla||'').toLowerCase() === 'plan2009');
  console.log('COLA plan2009 rows:', rows.length);
  console.log('COLA id range:', rows.length ? [rows[0].id, rows[rows.length-1].id] : []);
  const tail = rows.slice(-15);
  for (const r of tail) {
    console.log('COLA', r.id, r.accion, 'id_reg='+r.id_reg, 'fecha='+r.fechaiso, r.horini+'-'+r.horfin, r.nomcli);
  }
  const stuck = rows.filter(r => Number(r.id) > 5).slice(0, 10);
  console.log('--- First rows after id 5 ---');
  for (const r of stuck) {
    console.log('COLA', r.id, r.accion, 'id_reg='+r.id_reg, r.fechaiso, r.horini, r.horfin);
  }
}

const planPath = find('plan2009.dbf');
if (planPath) {
  const rows = readDbf(planPath);
  const ids = new Set(['112220','112221','1000000000','1000000001','1000000002']);
  console.log('--- plan2009 DBF targets ---');
  for (const r of rows) {
    const id = String(r.idplan ?? '').trim();
    const norm = id.replace(/^0+/, '') || '0';
    if (!ids.has(norm) && !ids.has(id)) continue;
    console.log('PLAN', id, r.fecha, r.horini+'-'+r.horfin, r.codemp, r.nomcli);
  }
}
"
