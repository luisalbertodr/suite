"""Auditoría facturación Medicina mayo 2026 vs Dunasoft."""
from __future__ import annotations

import os
import re
from decimal import Decimal
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor

ROOT = Path(__file__).resolve().parents[1]
MEDICINA = "816af484-92a0-4f65-a5a7-1c907aa4bb3d"
ESTETICA = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"

DUNA_TSV = """
908	04-May-26	007696	250	TARJETA	Neuromoduladores
911	04-May-26	007695	500	TARJETA	SCULPTRA
913	04-May-26	001278	200	EFECTIVO	Mesoterapia para lipolisis
923	05-May-26	007933	250	EFECTIVO	Rostro o Cuello LASERME
927	06-May-26	000702	200	EFECTIVO	Mesoterapia para lipolisis
929	06-May-26	008033	200	TARJETA	Mesoterapia para lipolisis
930	06-May-26	003233	72,15	EFECTIVO	MASLINIC BOOSTER AMPOULES
931	06-May-26	002019	800	TARJETA	Vial hialuronico/algeness
932	06-May-26	008081	200	TARJETA	Mesoterapia(vitaminas o peptidos)
938	07-May-26	008044	340	EFECTIVO	Rostro y Cuello LASERME
968	11-May-26	008047	200	TARJETA	Mesoterapia para lipolisis
969	11-May-26	002582	380	EFECTIVO	Neuromoduladores
970	11-May-26	000330	0	EFECTIVO	Skymedic Wrinkles
971	11-May-26	007931	200	TARJETA	Mesoterapia para lipolisis
986	13-May-26	007578	50	EFECTIVO	FOTORREJ O MANCHAS
993	13-May-26	004986	380	EFECTIVO	Neuromoduladores
996	13-May-26	007727	0	EFECTIVO	Rostro y Cuello LASERME
997	13-May-26	004047	0	EFECTIVO	Revision
998	13-May-26	007578	200	TARJETA	Mesoterapia para lipolisis
1001	13-May-26	008137	0	EFECTIVO	Consulta
1002	13-May-26	005546	200	EFECTIVO	Mesoterapia para lipolisis
1031	15-May-26	006733	350	EFECTIVO	Rostro y Cuello LASERME
1032	15-May-26	006733	-350	EFECTIVO	Rostro y Cuello LASERME
1033	15-May-26	006733	350	EFECTIVO	Rostro y Cuello LASERME
1038	18-May-26	008094	120	TARJETA	Consulta
1043	18-May-26	008044	0	EFECTIVO	Revision
1045	18-May-26	008033	390	TARJETA	Mesoterapia para lipolisis
1047	18-May-26	000702	200	EFECTIVO	Mesoterapia para lipolisis
1049	18-May-26	008088	120	EFECTIVO	Consulta
1061	20-May-26	006733	0	EFECTIVO	Revision
1063	20-May-26	008096	35,5	EFECTIVO	SUNSCREEN SPF50+
1064	20-May-26	008096	0	EFECTIVO	Consulta
1065	20-May-26	002019	16	TARJETA	Revision
1066	20-May-26	001278	200	EFECTIVO	Mesoterapia para lipolisis
1068	20-May-26	005439	44,95	TARJETA	Revision
1093	25-May-26	008047	200	TARJETA	Mesoterapia para lipolisis
1095	25-May-26	008039	394,95	EFECTIVO	Rostro y Cuello LASERME
1096	25-May-26	000871	550	EFECTIVO	SCULPTRA
1097	25-May-26	002582	0	EFECTIVO	Revision
1099	25-May-26	005994	233,5	TARJETA	Periocular LASERME
1100	25-May-26	007931	200	TARJETA	Mesoterapia para lipolisis
1101	25-May-26	002087	0	EFECTIVO	Revision
1129	27-May-26	007578	100	TARJETA	Mesoterapia para lipolisis
1143	27-May-26	005546	200	EFECTIVO	Mesoterapia(vitaminas o peptidos)
1145	27-May-26	002019	900	TARJETA	HIDROXIAPATITA+HIALURONICO
1176	29-May-26	004963	48,85	TARJETA	MASLINIC NIGHT
""".strip()


def load_dotenv() -> None:
    env = ROOT / ".env"
    if not env.is_file():
        return
    for line in env.read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith("SUPABASE_DB_URL="):
            os.environ["SUPABASE_DB_URL"] = line.split("=", 1)[1].strip().strip('"')


def parse_dec(v) -> Decimal:
    return Decimal(str(v).replace(",", "."))


def parse_legacy_amt(v) -> Decimal:
    try:
        return Decimal(str(v).replace(",", ".").strip() or "0")
    except Exception:
        return Decimal(0)


def load_duna_rows():
    rows = []
    for line in DUNA_TSV.splitlines():
        parts = line.split("\t")
        numfac, fec, codcli, tot, forpag, desart = parts
        rows.append(
            {
                "numfac": numfac,
                "fec": fec,
                "codcli": codcli,
                "tot": parse_dec(tot),
                "forpag": forpag,
                "desart": desart,
            }
        )
    return rows


def codcli_variants(cod: str) -> list[str]:
    c = str(cod or "").strip()
    variants = [c]
    stripped = c.lstrip("0")
    if stripped and stripped not in variants:
        variants.append(stripped)
    padded = c.zfill(6)
    if padded not in variants:
        variants.append(padded)
    return variants


def main() -> None:
    load_dotenv()
    duna_rows = load_duna_rows()
    duna_total = sum(r["tot"] for r in duna_rows)
    duna_numfacs = sorted(set(r["numfac"] for r in duna_rows), key=int)

    print("=== DUNASOFT (datos usuario) ===")
    print(f"Lineas: {len(duna_rows)}")
    print(f"Facturas distintas (numfac): {len(duna_numfacs)}")
    print(f"Total lineas: {duna_total:.2f} EUR")

    conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute(
        """
        SELECT COUNT(*) c, ROUND(COALESCE(SUM(total_amount),0)::numeric,2) total
        FROM invoices
        WHERE company_id = %s
          AND issue_date >= '2026-05-01' AND issue_date < '2026-06-01'
          AND lower(coalesce(status,'')) NOT IN ('cancelled','void','anulada')
        """,
        (MEDICINA,),
    )
    inv_med = cur.fetchone()
    print("\n=== SUITE empresa Medicina (816af484) ===")
    print(f"Facturas issue_date mayo: {inv_med}")

    cur.execute(
        """
        SELECT COUNT(*) c, ROUND(COALESCE(SUM(total_amount),0)::numeric,2) total
        FROM sales
        WHERE company_id = %s AND status='completed' AND invoice_id IS NULL
          AND created_at >= '2026-05-01' AND created_at < '2026-06-01'
        """,
        (MEDICINA,),
    )
    sales_med = cur.fetchone()
    print(f"TPV sin factura mayo: {sales_med}")
    dash = float(inv_med["total"]) + float(sales_med["total"])
    print(f"Total dashboard medicina: {dash:.2f} EUR (diff vs Dunasoft: {dash - float(duna_total):+.2f})")

    cur.execute(
        """
        SELECT i.id, i.number, i.issue_date, i.total_amount,
               public.resolve_invoice_billing_company_id(i.id, %s::uuid) AS billing_co
        FROM invoices i
        WHERE i.issue_date >= '2026-05-01' AND i.issue_date < '2026-06-01'
          AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
          AND i.company_id IN (%s, %s)
        ORDER BY i.issue_date, i.number
        """,
        (ESTETICA, ESTETICA, MEDICINA),
    )
    all_inv = cur.fetchall()
    med_inv = [r for r in all_inv if str(r["billing_co"]) == MEDICINA]
    med_total_resolved = sum(Decimal(str(r["total_amount"] or 0)) for r in med_inv)
    print(
        f"\nFacturas mayo clasificadas medicina (resolve fn): {len(med_inv)} -> {med_total_resolved:.2f} EUR"
    )

    cur.execute(
        """
        SELECT name FROM article_families
        WHERE billing_company_id = %s AND company_id = %s
        """,
        (MEDICINA, ESTETICA),
    )
    med_families = {r["name"] for r in cur.fetchall()}

    cur.execute(
        """
        SELECT a.codigo FROM articles a
        WHERE COALESCE(a.billing_company_id,
          (SELECT billing_company_id FROM article_families af
           WHERE af.name=a.familia AND af.company_id=a.company_id LIMIT 1)
        ) = %s AND a.company_id = %s
        """,
        (MEDICINA, ESTETICA),
    )
    med_codes = {str(r["codigo"]).strip().upper() for r in cur.fetchall()}

    cur.execute(
        """
        SELECT fc.numfac, fc.fecfac, fc.codcli, fc.totfac AS cab_tot, fc.forpag1, fc.serfac,
               fl.desart, fl.codart, fl.subtot, fl.tipfam1
        FROM legacy.faccab fc
        JOIN legacy.faclin fl
          ON fl.numfac = fc.numfac AND fl.serfac = fc.serfac AND fl.ejefac = fc.ejefac
        WHERE fc.fecfac::date >= '2026-05-01' AND fc.fecfac::date < '2026-06-01'
          AND upper(btrim(coalesce(fc.anulada,''))) NOT IN ('S','SI','1','T','TRUE','Y','YES','X')
        ORDER BY fc.fecfac, fc.numfac
        """
    )
    legacy_lines = cur.fetchall()

    def is_med_line(r) -> bool:
        cod = str(r.get("codart") or "").strip().upper()
        if cod in med_codes:
            return True
        fam = str(r.get("tipfam1") or "").strip()
        return fam in med_families

    med_legacy = [r for r in legacy_lines if is_med_line(r)]
    leg_total = sum(parse_legacy_amt(r["subtot"]) for r in med_legacy)
    print(f"\nLegacy faclin medicina mayo: {len(med_legacy)} lineas -> {leg_total:.2f} EUR")
    print(f"(diff vs usuario: {leg_total - duna_total:+.2f})")

    leg_idx: dict[tuple, dict] = {}
    for r in legacy_lines:
        amt = parse_legacy_amt(r["subtot"])
        cod = str(r["codcli"] or "").strip()
        for cv in codcli_variants(cod):
            key = (str(r["numfac"]).strip(), cv, amt, (r["desart"] or "").strip().upper())
            leg_idx[key] = r

    missing = []
    for dr in duna_rows:
        found = False
        for cv in codcli_variants(dr["codcli"]):
            key = (dr["numfac"], cv, dr["tot"], dr["desart"].strip().upper())
            if key in leg_idx:
                found = True
                break
        if not found:
            missing.append(dr)

    print(f"\nLineas usuario en legacy.faclin: {len(duna_rows) - len(missing)}/{len(duna_rows)}")
    if missing:
        print("No encontradas en legacy:")
        for d in missing:
            print(f"  numfac={d['numfac']} codcli={d['codcli']} {d['tot']} {d['desart']}")

    cur.execute(
        """
        SELECT i.id, i.number, i.issue_date, i.total_amount, i.company_id,
               i.notes, c.legacy_codcli
        FROM invoices i
        LEFT JOIN customers c ON c.id = i.customer_id
        WHERE i.issue_date >= '2026-05-01' AND i.issue_date < '2026-06-01'
          AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
        ORDER BY i.issue_date, i.number
        """
    )
    suite_all_may = cur.fetchall()

    def extract_numfac(num: str | None) -> str | None:
        m = re.search(r"(\d+)\s*$", str(num or ""))
        return m.group(1) if m else None

    suite_by_numfac: dict[str, list] = {}
    for r in suite_all_may:
        nf = extract_numfac(r["number"])
        if not nf and r.get("notes"):
            m = re.search(r"numfac[=\s]+(\d+)", str(r["notes"]), re.I)
            nf = m.group(1) if m else None
        if nf:
            suite_by_numfac.setdefault(nf, []).append(r)

    duna_by_nf: dict[str, Decimal] = {}
    for r in duna_rows:
        duna_by_nf.setdefault(r["numfac"], Decimal(0))
        duna_by_nf[r["numfac"]] += r["tot"]

    print("\n=== Comparacion por numfac (suma lineas Dunasoft vs factura Suite) ===")
    mismatch = []
    ok = 0
    for nf in sorted(duna_by_nf, key=int):
        duna_amt = duna_by_nf[nf]
        suite_rows = suite_by_numfac.get(nf, [])
        suite_amt = sum(Decimal(str(r["total_amount"] or 0)) for r in suite_rows)
        diff = suite_amt - duna_amt
        if not suite_rows or abs(diff) > Decimal("0.02"):
            co = str(suite_rows[0]["company_id"])[:8] if suite_rows else "-"
            mismatch.append((nf, duna_amt, suite_amt, diff, co, len(suite_rows)))
        else:
            ok += 1

    print(f"Coinciden: {ok} | Desfase o ausente: {len(mismatch)}")
    for row in mismatch:
        print(
            f"  numfac={row[0]:>4} duna={row[1]:>8.2f} suite={row[2]:>8.2f} "
            f"diff={row[3]:+8.2f} invs={row[5]} co={row[4]}"
        )

    in_duna_not_suite = [nf for nf in duna_numfacs if nf not in suite_by_numfac]
    print(f"\nnumfac Dunasoft sin factura Suite: {in_duna_not_suite}")

    # Sales linked to appointments in may for medicina
    cur.execute(
        """
        SELECT s.ticket_number, s.total_amount, s.company_id, a.legacy_codcli, a.appointment_date
        FROM sales s
        JOIN agenda_appointments a ON a.id = s.appointment_id
        WHERE s.status = 'completed'
          AND a.appointment_date >= '2026-05-01' AND a.appointment_date < '2026-06-01'
          AND s.company_id IN (%s, %s)
        ORDER BY a.appointment_date
        """,
        (MEDICINA, ESTETICA),
    )
    may_sales = cur.fetchall()
    med_sales = [r for r in may_sales if str(r["company_id"]) == MEDICINA]
    print(f"\nVentas con cita mayo (medicina co): {len(med_sales)}")
    print(f"Ventas con cita mayo (todas co): {len(may_sales)}")

    # Unmatched faccab promote script keys
    cur.execute(
        """
        SELECT i.number, i.total_amount, i.notes
        FROM invoices i
        WHERE i.issue_date >= '2026-05-01' AND i.issue_date < '2026-06-01'
          AND i.notes ILIKE 'Factura legacy sin cita%'
        """
    )
    legacy_promoted = cur.fetchall()
    print(f"\nFacturas 'legacy sin cita' mayo: {len(legacy_promoted)}")
    for r in legacy_promoted[:10]:
        print(f"  {r['number']} {r['total_amount']} | {r['notes'][:60]}")

    conn.close()


def detail() -> None:
    load_dotenv()
    duna_rows = load_duna_rows()
    duna_numfacs = [r["numfac"] for r in duna_rows]
    duna_amt_by_nf: dict[str, Decimal] = {}
    for r in duna_rows:
        duna_amt_by_nf.setdefault(r["numfac"], Decimal(0))
        duna_amt_by_nf[r["numfac"]] += r["tot"]

    conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute(
        """
        SELECT i.id, i.number, i.issue_date, i.total_amount, i.company_id, i.notes,
               public.resolve_invoice_billing_company_id(i.id, %s::uuid) AS billing_co
        FROM invoices i
        WHERE i.issue_date >= '2026-05-01' AND i.issue_date < '2026-06-01'
          AND (i.notes ILIKE '%%legacy%%' OR i.number ILIKE 'FAC-%%')
        ORDER BY i.issue_date, i.number
        """,
        (ESTETICA,),
    )
    rows = cur.fetchall()

    def extract_legacy_numfac(notes: str | None) -> str | None:
        if not notes:
            return None
        m = re.search(r"\|(\d+)\s*$", notes)
        return m.group(1) if m else None

    by_numfac: dict[str, dict] = {}
    for r in rows:
        nf = extract_legacy_numfac(r.get("notes"))
        if nf:
            by_numfac[nf] = r

    matched = [nf for nf in set(duna_numfacs) if nf in by_numfac]
    missing_nf = [nf for nf in sorted(set(duna_numfacs), key=int) if nf not in by_numfac]

    print("\n=== DETALLE: emparejamiento por notes key legacy ===")
    print(f"Facturas mayo legacy en Suite: {len(rows)}")
    print(f"Dunasoft numfacs emparejados: {len(matched)}/{len(set(duna_numfacs))}")
    print(f"Sin factura Suite: {missing_nf}")

    miss_sum = sum(duna_amt_by_nf.get(nf, Decimal(0)) for nf in missing_nf)
    print(f"Importe Dunasoft sin factura Suite: {miss_sum:.2f} EUR")

    print("\nEmparejados (numfac -> Suite):")
    ok = bad = 0
    for nf in sorted(matched, key=int):
        r = by_numfac[nf]
        duna = duna_amt_by_nf[nf]
        suite = Decimal(str(r["total_amount"] or 0))
        diff = suite - duna
        co = str(r["company_id"])[:8]
        bill = str(r["billing_co"])[:8]
        status = "OK" if abs(diff) <= Decimal("0.02") else "DIFF"
        if status == "OK":
            ok += 1
        else:
            bad += 1
        print(
            f"  {nf:>4} duna={duna:>8.2f} suite={suite:>8.2f} {status:4} "
            f"{r['number']} co={co} bill={bill}"
        )
    print(f"Importe OK: {ok} | con desfase: {bad}")

    cur.execute(
        """
        SELECT i.number, i.issue_date, i.total_amount, i.notes,
               (SELECT string_agg(ii.description, ' | ')
                FROM invoice_items ii WHERE ii.invoice_id=i.id) AS items
        FROM invoices i
        WHERE i.company_id = %s AND i.issue_date >= '2026-05-01' AND i.issue_date < '2026-06-01'
        ORDER BY i.issue_date
        """,
        (MEDICINA,),
    )
    med = cur.fetchall()
    print(f"\n=== {len(med)} facturas company_id=Medicina ===")
    med_total = Decimal(0)
    for r in med:
        med_total += Decimal(str(r["total_amount"] or 0))
        items = (r["items"] or "")[:55]
        print(f"  {r['issue_date']} {r['number']:12} {Decimal(str(r['total_amount'])):>8.2f} | {items}")
    print(f"Total Medicina: {med_total:.2f}")

    cur.execute(
        """
        SELECT i.number, i.issue_date, i.total_amount, i.notes
        FROM invoices i
        WHERE i.issue_date >= '2026-05-01' AND i.issue_date < '2026-06-01'
          AND public.resolve_invoice_billing_company_id(i.id, %s::uuid) = %s
          AND i.company_id = %s
        """,
        (ESTETICA, MEDICINA, ESTETICA),
    )
    wrong_co = cur.fetchall()
    print(f"\nFacturas billing=medicina pero company=estetica: {len(wrong_co)}")
    for r in wrong_co:
        print(f"  {r['number']} {r['total_amount']} {r['issue_date']}")

    cur.execute(
        """
        SELECT s.ticket_number, s.total_amount, s.invoice_id, a.legacy_codcli, a.appointment_date
        FROM sales s
        LEFT JOIN agenda_appointments a ON a.id = s.appointment_id
        WHERE s.company_id = %s AND s.status='completed'
          AND s.created_at >= '2026-05-01' AND s.created_at < '2026-06-01'
        ORDER BY s.created_at
        """,
        (MEDICINA,),
    )
    sales = cur.fetchall()
    st = sum(Decimal(str(s["total_amount"] or 0)) for s in sales)
    print(f"\nSales medicina mayo: {len(sales)} -> {st:.2f} EUR")

    # Legacy DB: sum user numfacs from faccab header totfac
    placeholders = ",".join(["%s"] * len(set(duna_numfacs)))
    cur.execute(
        f"""
        SELECT numfac, fecfac, codcli, totfac, serfac, forpag1
        FROM legacy.faccab
        WHERE numfac IN ({placeholders})
          AND fecfac::date >= '2026-05-01' AND fecfac::date < '2026-06-01'
        ORDER BY numfac
        """,
        tuple(set(duna_numfacs)),
    )
    faccab = cur.fetchall()
    print(f"\nLegacy faccab headers for user numfacs: {len(faccab)}")
    leg_header_sum = sum(parse_legacy_amt(r["totfac"]) for r in faccab)
    print(f"Suma totfac cabeceras: {leg_header_sum:.2f} EUR")

    conn.close()


def match_lines() -> None:
    from datetime import datetime

    load_dotenv()
    duna_rows = load_duna_rows()
    for r in duna_rows:
        r["dt"] = datetime.strptime(r["fec"], "%d-%b-%y").date()
        r["cod"] = (r["codcli"].lstrip("0") or "0")

    conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        """
        SELECT i.number, i.issue_date, i.total_amount, c.legacy_codcli,
               (SELECT string_agg(ii.description, ' | ')
                FROM invoice_items ii WHERE ii.invoice_id = i.id) AS items
        FROM invoices i
        JOIN customers c ON c.id = i.customer_id
        WHERE i.company_id = %s
          AND i.issue_date >= '2026-05-01' AND i.issue_date < '2026-06-01'
        ORDER BY i.issue_date, i.number
        """,
        (MEDICINA,),
    )
    suite = cur.fetchall()
    for s in suite:
        s["cod"] = str(s["legacy_codcli"] or "").lstrip("0") or "0"
        s["amt"] = Decimal(str(s["total_amount"] or 0))
        s["used"] = False

    matched: list = []
    partial: list = []
    missing: list = []
    for d in duna_rows:
        cands = [
            s
            for s in suite
            if not s["used"] and s["issue_date"] == d["dt"] and s["cod"] == d["cod"]
        ]
        if not cands:
            cands = [
                s
                for s in suite
                if not s["used"]
                and s["issue_date"] == d["dt"]
                and abs(s["amt"] - d["tot"]) <= Decimal("0.02")
            ]
        exact = [s for s in cands if abs(s["amt"] - d["tot"]) <= Decimal("0.02")]
        if exact:
            s = exact[0]
            s["used"] = True
            matched.append((d, s))
        elif cands:
            s = cands[0]
            s["used"] = True
            partial.append((d, s, s["amt"] - d["tot"]))
        else:
            missing.append(d)

    unused = [s for s in suite if not s["used"]]
    print("\n=== EMPAREJAMIENTO fecha+codcli/importe ===")
    print(
        f"Exactos: {len(matched)} | Desfase: {len(partial)} | "
        f"Sin Suite: {len(missing)} | Suite sobrante: {len(unused)}"
    )

    print("\n--- Sin reflejo en Suite (importe > 0) ---")
    miss_amt = Decimal(0)
    for d in missing:
        if d["tot"] != 0:
            miss_amt += d["tot"]
            print(
                f"  numfac={d['numfac']} {d['dt']} cod={d['codcli']} "
                f"{d['tot']:>8.2f} {d['desart']}"
            )
    print(f"Total importe ausente: {miss_amt:.2f} EUR")

    print("\n--- Importe distinto ---")
    for d, s, diff in partial:
        print(
            f"  numfac={d['numfac']} duna={d['tot']} suite={s['amt']} "
            f"diff={diff:+.2f} {s['number']} | {d['desart'][:40]}"
        )

    print("\n--- Facturas Suite sin línea Dunasoft ---")
    extra_amt = Decimal(0)
    for s in unused:
        extra_amt += s["amt"]
        print(
            f"  {s['issue_date']} {s['number']} {s['amt']:>8.2f} "
            f"cod={s['cod']} | {(s['items'] or '')[:50]}"
        )
    print(f"Total Suite extra: {extra_amt:.2f} EUR")

    conn.close()


def cross_company() -> None:
    load_dotenv()
    duna_rows = load_duna_rows()
    duna_amt_by_nf: dict[str, Decimal] = {}
    for r in duna_rows:
        duna_amt_by_nf.setdefault(r["numfac"], Decimal(0))
        duna_amt_by_nf[r["numfac"]] += r["tot"]

    conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
    cur = conn.cursor(cursor_factory=RealDictCursor)

    def extract_legacy_numfac(notes: str | None) -> str | None:
        if not notes:
            return None
        m = re.search(r"\|(\d+)\s*$", notes)
        return m.group(1) if m else None

    cur.execute(
        """
        SELECT i.number, i.issue_date, i.total_amount, i.company_id, i.notes,
               public.resolve_invoice_billing_company_id(i.id, %s::uuid) AS billing_co
        FROM invoices i
        WHERE i.issue_date >= '2026-05-01' AND i.issue_date < '2026-06-01'
          AND i.notes ILIKE 'Factura legacy sin cita%%'
        ORDER BY i.issue_date
        """,
        (ESTETICA,),
    )
    legacy_inv = cur.fetchall()
    by_nf = {}
    for r in legacy_inv:
        nf = extract_legacy_numfac(r.get("notes"))
        if nf:
            by_nf[nf] = r

    print("\n=== Facturas legacy sin cita que cubren numfacs Dunasoft ===")
    for nf in sorted(duna_amt_by_nf, key=int):
        if nf not in by_nf:
            continue
        r = by_nf[nf]
        duna = duna_amt_by_nf[nf]
        suite = Decimal(str(r["total_amount"] or 0))
        co = "Medicina" if str(r["company_id"]) == MEDICINA else "Estética"
        print(
            f"  numfac={nf} duna={duna:.2f} suite={suite:.2f} "
            f"{r['number']} empresa={co}"
        )

    missing_positive = [
        (nf, duna_amt_by_nf[nf])
        for nf in sorted(duna_amt_by_nf, key=int)
        if nf not in by_nf and duna_amt_by_nf[nf] > 0
    ]
    # subtract those matched in medicina company (approx - we'll list key ones)
    print("\n=== numfacs Dunasoft sin factura legacy NI en empresa Medicina ===")
    cur.execute(
        """
        SELECT i.number, i.total_amount, i.company_id, i.notes, i.issue_date
        FROM invoices i
        WHERE i.issue_date >= '2026-05-01' AND i.issue_date < '2026-06-01'
          AND i.notes ILIKE 'Factura legacy sin cita%%'
        """,
    )
    all_legacy = {extract_legacy_numfac(r["notes"]): r for r in cur.fetchall()}
    all_legacy.pop(None, None)

    cur.execute(
        """
        SELECT i.number, i.total_amount, i.company_id, c.legacy_codcli, i.issue_date,
               (SELECT string_agg(ii.description,' | ') FROM invoice_items ii WHERE ii.invoice_id=i.id) items
        FROM invoices i
        JOIN customers c ON c.id=i.customer_id
        WHERE i.company_id IN (%s,%s)
          AND i.issue_date >= '2026-05-01' AND i.issue_date < '2026-06-01'
        ORDER BY i.company_id, i.issue_date
        """,
        (MEDICINA, ESTETICA),
    )
    all_may = cur.fetchall()

    # Search SCULPTRA / key missing
    print("\nFacturas mayo con SCULPTRA o HIDROXIAPATITA en líneas:")
    for r in all_may:
        items = (r.get("items") or "").upper()
        if "SCULPTRA" in items or "HIDROXI" in items or "MASLINIC NIGHT" in items:
            co = "Med" if str(r["company_id"]) == MEDICINA else "Est"
            print(
                f"  {co} {r['issue_date']} {r['number']} {r['total_amount']} "
                f"cod={r['legacy_codcli']} | {r.get('items','')[:55]}"
            )

    not_anywhere = []
    for nf, amt in missing_positive:
        if nf in all_legacy:
            continue
        not_anywhere.append((nf, amt))
    total_na = sum(a for _, a in not_anywhere)
    print(f"\nImporte numfacs sin factura legacy (solo ventas Medicina): {total_na:.2f} EUR")
    for nf, amt in not_anywhere:
        row = next((d for d in duna_rows if d["numfac"] == nf), None)
        desc = row["desart"] if row else ""
        print(f"  {nf} {amt:.2f} {desc}")

    conn.close()


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "--detail":
        detail()
        match_lines()
    elif len(sys.argv) > 1 and sys.argv[1] == "--match":
        match_lines()
    elif len(sys.argv) > 1 and sys.argv[1] == "--cross":
        cross_company()
    else:
        main()
        detail()
        match_lines()
        cross_company()
