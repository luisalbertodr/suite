import { createClient } from "@supabase/supabase-js";
import { getCompanyId } from "./legacy_company.js";

const url = "https://supabase.lipoout.com";
const key =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE2Nzg4ODY0MDAsImV4cCI6MTc5OTUzNTYwMH0.T_fOOOaoiFAyTLDkSCoaGwxy7TjlacSHJn2aZyCFP0M";
const company = getCompanyId();

const s = createClient(url, key);
const FETCH_BATCH = 1000;
const INSERT_BATCH = 500;
const colors = [
  "#3B82F6",
  "#10B981",
  "#8B5CF6",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#14B8A6",
  "#6366F1",
  "#84CC16",
  "#F97316",
];

function norm(v) {
  return v == null ? "" : String(v).trim();
}

function parseDate(d) {
  const t = norm(d);
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!m) return null;
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  return `${m[3]}-${mm}-${dd}`;
}

function parseTime(h) {
  let t = norm(h);
  if (!t) return null;
  if (/^\d{4}$/.test(t)) t = `${t.slice(0, 2)}:${t.slice(2)}`;
  const m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = Number(m[3] || 0);
  if (hh > 23 || mm > 59 || ss > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(
    ss
  ).padStart(2, "0")}`;
}

function addMinutesIso(date, time, minutes) {
  const m = String(time || "").match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return `${date}T${time}`;
  let hh = Number(m[1]);
  let mm = Number(m[2]);
  const ss = Number(m[3] || 0);
  let total = hh * 60 + mm + minutes;
  while (total < 0) total += 1440;
  total = total % 1440;
  hh = Math.floor(total / 60);
  mm = total % 60;
  return `${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(
    ss
  ).padStart(2, "0")}`;
}

function colorForEmp(emp) {
  const sum = [...emp].reduce((a, c) => a + c.charCodeAt(0), 0);
  return colors[Math.abs(sum) % colors.length];
}

function displayEmployeeName(emp) {
  if (emp === "SIN_ASIGNAR") return "Sin asignar";
  const numeric = emp.match(/^0*(\d+)$/);
  if (numeric) return `Empleado ${numeric[1]}`;
  return `Empleado ${emp}`;
}

async function main() {
  console.log("STEP 1: limpiar agenda previa de la empresa");
  let r = await s.from("agenda_appointments").delete().eq("company_id", company);
  if (r.error) throw r.error;
  r = await s.from("agenda_employees").delete().eq("company_id", company);
  if (r.error) throw r.error;

  console.log("STEP 2: leer historial y construir citas unicas");
  const employees = new Set();
  const appointments = [];
  const seen = new Set();
  let offset = 0;
  let totalRead = 0;

  for (;;) {
    const q = await s
      .from("customer_aesthetic_history")
      .select("id,customer_id,event_date,data")
      .eq("company_id", company)
      .eq("event_type", "CITA_HISTORICA")
      .range(offset, offset + FETCH_BATCH - 1);
    if (q.error) throw q.error;

    const rows = q.data || [];
    if (!rows.length) break;
    totalRead += rows.length;

    for (const row of rows) {
      const data = row.data || {};
      const emp = norm(data.empleado || data.empleado_id || data.CODEMP || "SIN_ASIGNAR");
      employees.add(emp);

      const date = parseDate(row.event_date) || parseDate(data.fecha);
      if (!date) continue;
      const textoBase = norm(data.texto || "");
      const horaEnTexto = (textoBase.match(/\[(\d{1,2}:\d{2})\]/) || [])[1] || null;
      const startTime =
        parseTime(horaEnTexto || data.hora_inicio || data.hora || data.HORA || "09:00") ||
        "09:00:00";
      const endTime = parseTime(data.hora_fin || data.HORFIN);
      let endFinal = endTime;
      if (!endFinal) {
        endFinal = addMinutesIso(date, startTime, 30).slice(11, 19);
      }
      const startMin = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3, 5));
      const endMin = Number(endFinal.slice(0, 2)) * 60 + Number(endFinal.slice(3, 5));
      if (endMin <= startMin) {
        endFinal = addMinutesIso(date, startTime, 30).slice(11, 19);
      }

      const startIso = `${date}T${startTime}`;
      const endIso = `${date}T${endFinal}`;
      const startHm = startTime.slice(0, 5);
      const endHm = endFinal.slice(0, 5);
      const servicio = norm(data.servicio || data.planart);
      const texto = textoBase;
      const title = (servicio || texto || "Cita importada").slice(0, 200) || "Cita importada";
      const description = (texto || servicio || "").slice(0, 1000) || null;

      const sig = [
        row.customer_id || "",
        date,
        startTime,
        emp,
        title,
        description || "",
      ].join("|");
      if (seen.has(sig)) continue;
      seen.add(sig);

      appointments.push({
        customer_id: row.customer_id || null,
        emp_legacy: emp,
        appointment_date: date,
        start_hm: startHm,
        end_hm: endHm,
        start_time: startIso,
        end_time: endIso,
        title,
        description,
      });
    }

    if (offset % 20000 === 0) {
      console.log(
        "leidas",
        totalRead,
        "citas_unicas",
        appointments.length,
        "empleados",
        employees.size
      );
    }
    offset += FETCH_BATCH;
  }

  console.log("STEP 3: crear empleados", employees.size);
  const empMap = new Map();
  let createdEmp = 0;
  for (const emp of employees) {
    const name = displayEmployeeName(emp);
    const ins = await s
      .from("agenda_employees")
      .insert([
        {
          company_id: company,
          name,
          color: colorForEmp(emp),
          is_active: true,
        },
      ])
      .select("id")
      .single();
    if (ins.error) throw ins.error;
    empMap.set(emp, ins.data.id);
    createdEmp += 1;
    if (createdEmp % 200 === 0) console.log("empleados_creados", createdEmp);
  }

  console.log("STEP 4: insertar citas", appointments.length);
  let inserted = 0;
  for (let i = 0; i < appointments.length; i += INSERT_BATCH) {
    const slice = appointments.slice(i, i + INSERT_BATCH);
    const batchNew = slice.map((a) => ({
      company_id: company,
      customer_id: a.customer_id,
      employee_id: empMap.get(a.emp_legacy) || null,
      title: a.title,
      description: a.description,
      start_time: a.start_time,
      end_time: a.end_time,
      status: "completed",
      color: "#3B82F6",
    }));
    let ins = await s.from("agenda_appointments").insert(batchNew).select("id");
    if (ins.error && String(ins.error.message || "").includes("customer_id")) {
      const batchLegacy = slice.map((a) => ({
        company_id: company,
        employee_id: empMap.get(a.emp_legacy) || null,
        client_name: "Cliente importado",
        description: a.description || a.title,
        start_time: a.start_hm,
        end_time: a.end_hm,
        appointment_date: a.appointment_date,
        status: "confirmed",
        color: "bg-blue-100 border-blue-300",
      }));
      ins = await s.from("agenda_appointments").insert(batchLegacy).select("id");
    }
    if (ins.error) throw ins.error;
    inserted += (ins.data || []).length;
    if (inserted % 5000 === 0) console.log("citas_insertadas", inserted);
  }

  const cA = await s
    .from("agenda_appointments")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company);
  const cE = await s
    .from("agenda_employees")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company);

  console.log(
    JSON.stringify(
      {
        done: true,
        totalRead,
        uniqueAppointments: appointments.length,
        employeesCreated: createdEmp,
        appointmentsInDb: cA.count,
        employeesInDb: cE.count,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error("MIGRATION_ERROR", e);
  process.exit(1);
});
