import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { fmtFecha } from "../lib/format";
import "../styles/clinico.css";

const usd = (n) => "$" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd0 = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("en-US");
const ESTADO_CITA = { pendiente: "Pendiente", confirmada: "Confirmada", completada: "Completada", cancelada: "Cancelada", no_asistio: "No asistió" };
const TAG_CITA = { pendiente: "ta", confirmada: "tg", completada: "tg", cancelada: "tr", no_asistio: "tr" };
const TAG_PRES = { pendiente: "ta", aceptado: "tg", cobrado: "tg" };
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function hoyEnZona(tz) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function horaEnZona(tz) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(new Date()));
}
function sumarDias(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + n));
  return x.toISOString().slice(0, 10);
}
// PostgREST devuelve máx. 1000 filas por consulta: se pagina hasta un tope para no calcular con datos truncados.
async function traer(build, tope = 5000) {
  let todo = [], desde = 0;
  while (desde < tope) {
    const { data, error } = await build().range(desde, desde + 999);
    if (error) return { data: todo, error };
    todo = todo.concat(data || []);
    if (!data || data.length < 1000) return { data: todo };
    desde += 1000;
  }
  return { data: todo, truncado: true };
}
const totalPres = (p) => {
  const neto = (p.presupuesto_items || []).reduce((s, it) => s + (Number(it.precio) || 0) * (1 - (Number(it.descuento) || 0) / 100), 0);
  return neto * (1 - (Number(p.descuento_pct) || 0) / 100);
};
function stockStatus(i) {
  const ratio = i.minimo > 0 ? i.stock / i.minimo : 1;
  if (i.stock === 0 || ratio < 0.3) return "critical";
  if (ratio < 1) return "low";
  return "ok";
}

function ActividadChart({ dias }) {
  const W = 560, H = 170, base = 140, top = 14, bw = 26;
  const max = Math.max(4, ...dias.map((d) => d.total));
  const paso = (W - 20) / dias.length;
  const y = (v) => base - (v / max) * (base - top);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Citas de los últimos 14 días">
      {[0, 0.5, 1].map((f) => <g key={f}><line x1="10" x2={W - 10} y1={y(max * f)} y2={y(max * f)} stroke="var(--border)" strokeDasharray={f ? "3 4" : "0"} /><text x="2" y={y(max * f) - 3} fontSize="9" fill="var(--muted)">{Math.round(max * f)}</text></g>)}
      {dias.map((d, i) => {
        const x = 14 + i * paso + (paso - bw) / 2;
        let acc = 0;
        const seg = [[d.ok, "var(--green)"], [d.act, "var(--teal)"], [d.mal, "var(--rose)"]];
        return (
          <g key={d.f}>
            {seg.map(([v, c], k) => { if (!v) return null; const y0 = y(acc + v), h = y(acc) - y0; acc += v; return <rect key={k} x={x} y={y0} width={bw} height={h} rx="3" style={{ fill: c }} />; })}
            {d.total > 0 && <text x={x + bw / 2} y={y(d.total) - 4} fontSize="9.5" textAnchor="middle" fill="var(--ink-soft)" fontWeight="700">{d.total}</text>}
            <text x={x + bw / 2} y={base + 14} fontSize="10" textAnchor="middle" fill={d.hoy ? "var(--teal2)" : "var(--muted)"} fontWeight={d.hoy ? 700 : 400}>{d.dia}</text>
            <title>{`${fmtFecha(d.f)}: ${d.total} cita(s)`}</title>
          </g>
        );
      })}
    </svg>
  );
}

function FlujoChart({ meses }) {
  const W = 560, H = 190, base = 150, top = 14, bw = 22;
  const max = Math.max(100, ...meses.flatMap((m) => [m.ing, m.gas]));
  const paso = (W - 20) / meses.length;
  const y = (v) => base - (v / max) * (base - top);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Flujo de caja de los últimos 6 meses">
      {[0, 0.5, 1].map((f) => <g key={f}><line x1="10" x2={W - 10} y1={y(max * f)} y2={y(max * f)} stroke="var(--border)" strokeDasharray={f ? "3 4" : "0"} /><text x="2" y={y(max * f) - 3} fontSize="9" fill="var(--muted)">{usd0(max * f)}</text></g>)}
      {meses.map((m, i) => {
        const cx = 14 + i * paso + paso / 2;
        return (
          <g key={m.k}>
            <rect x={cx - bw - 2} y={y(m.ing)} width={bw} height={base - y(m.ing)} rx="3" style={{ fill: "var(--teal)" }}><title>{`${m.label}: cobrado ${usd(m.ing)}`}</title></rect>
            <rect x={cx + 2} y={y(m.gas)} width={bw} height={base - y(m.gas)} rx="3" style={{ fill: "var(--rose)" }}><title>{`${m.label}: gastos ${usd(m.gas)}`}</title></rect>
            <text x={cx} y={base + 14} fontSize="10.5" textAnchor="middle" fill="var(--ink-soft)" fontWeight="700">{m.label}</text>
            <text x={cx} y={base + 28} fontSize="9.5" textAnchor="middle" style={{ fill: m.ing - m.gas >= 0 ? "var(--green)" : "var(--rose)" }}>{m.ing - m.gas >= 0 ? "+" : "−"}{usd0(Math.abs(m.ing - m.gas))}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Dashboard({ irA }) {
  const { profile, consultorio, timezone, rolUi } = useAuth();
  const cid = profile?.consultorio_id || null;
  const verFinanzas = rolUi === "admin" || rolUi === "recepcionista";
  const verLab = ["admin", "doctor", "recepcionista"].includes(rolUi);
  const verStock = rolUi === "admin" || rolUi === "recepcionista";
  const esClinico = ["admin", "doctor", "recepcionista"].includes(rolUi);
  const [d, setD] = useState(null);
  const [errores, setErrores] = useState([]);
  const [truncado, setTruncado] = useState(false);

  const hoy = useMemo(() => hoyEnZona(timezone), [timezone]);
  const ir = (m) => () => irA && irA(m);

  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!cid) { setD({}); return; }
      const errs = [], note = (r, que) => { if (r?.error) errs.push(`${que}: ${r.error.message}`); if (r?.truncado) setTruncado(true); return r; };
      const mesIni = hoy.slice(0, 7) + "-01";
      const desde30 = sumarDias(hoy, -29), manana = sumarDias(hoy, 1);
      const mk = (n) => { const [y, m] = hoy.split("-").map(Number); const x = new Date(Date.UTC(y, m - 1 - n, 1)); return x.toISOString().slice(0, 7); };
      const meses6 = [5, 4, 3, 2, 1, 0].map(mk);
      const desde6m = meses6[0] + "-01", desde12m = mk(11) + "-01";

      const docs = note(await supabase.from("doctores").select("id,nombre,profile_id").eq("consultorio_id", cid).eq("activo", true), "doctores");
      const doctores = docs.data || [];
      const miDoc = rolUi === "doctor" ? doctores.find((x) => x.profile_id === profile?.id) : null;
      const soloMio = (q) => (miDoc ? q.eq("doctor_id", miDoc.id) : q);

      const consultas = await Promise.all([
        traer(() => soloMio(supabase.from("citas").select("id,fecha,hora_inicio,estado,motivo,paciente_id,doctor_id").eq("consultorio_id", cid).gte("fecha", desde30).lte("fecha", hoy)), 4000),
        soloMio(supabase.from("citas").select("id,fecha,hora_inicio,estado,motivo,paciente_id,doctor_id").eq("consultorio_id", cid).gte("fecha", hoy).not("estado", "in", "(cancelada,no_asistio,completada)").order("fecha").order("hora_inicio").limit(12)),
        soloMio(supabase.from("citas").select("id", { count: "exact", head: true }).eq("consultorio_id", cid).eq("fecha", manana).eq("estado", "pendiente")),
        supabase.from("pacientes").select("id", { count: "exact", head: true }).eq("consultorio_id", cid).eq("activo", true),
        supabase.from("pacientes").select("id", { count: "exact", head: true }).eq("consultorio_id", cid).eq("activo", true).gte("created_at", mesIni),
        esClinico ? supabase.from("presupuestos").select("id,fecha,estado,descuento_pct,paciente_id,created_at,presupuesto_items(precio,descuento)").eq("consultorio_id", cid).order("created_at", { ascending: false }).limit(200) : Promise.resolve({ data: [] }),
        verFinanzas ? traer(() => supabase.from("abonos").select("monto,fecha,cargos!inner(consultorio_id)").eq("cargos.consultorio_id", cid).gte("fecha", desde6m)) : Promise.resolve({ data: [] }),
        verFinanzas ? traer(() => supabase.from("gastos").select("monto,fecha").eq("consultorio_id", cid).gte("fecha", desde6m)) : Promise.resolve({ data: [] }),
        verFinanzas ? traer(() => supabase.from("cargos").select("total,fecha").eq("consultorio_id", cid).gte("fecha", desde12m)) : Promise.resolve({ data: [] }),
        verFinanzas ? traer(() => supabase.from("abonos").select("monto,cargos!inner(consultorio_id,fecha)").eq("cargos.consultorio_id", cid).gte("cargos.fecha", desde12m)) : Promise.resolve({ data: [] }),
        verLab ? supabase.from("trabajos_laboratorio").select("estado,fecha_entrega").eq("consultorio_id", cid).neq("estado", "entregado").limit(500) : Promise.resolve({ data: [] }),
        verStock ? supabase.from("insumos").select("nombre,stock,minimo").eq("consultorio_id", cid).eq("activo", true).limit(1000) : Promise.resolve({ data: [] }),
      ]);
      const [c30, prox, sinConf, nPac, nPacMes, pres, abo6, gas6, car12, abo12, lab, ins] = consultas.map((r, i) => note(r, ["citas", "próximas citas", "citas de mañana", "pacientes", "pacientes nuevos", "presupuestos", "abonos", "gastos", "cargos", "abonos 12m", "laboratorio", "inventario"][i]));

      const ids = [...new Set([...(prox.data || []).map((x) => x.paciente_id), ...(pres.data || []).slice(0, 6).map((x) => x.paciente_id)].filter(Boolean))];
      let pacNombre = {};
      if (ids.length) { const { data } = await supabase.from("pacientes").select("id,nombre").in("id", ids); pacNombre = Object.fromEntries((data || []).map((p) => [p.id, p.nombre])); }
      if (!vivo) return;

      // Actividad de citas (14 días) y asistencia (30 días)
      const porDia = {};
      (c30.data || []).forEach((c) => { const o = (porDia[c.fecha] ||= { ok: 0, act: 0, mal: 0 }); if (c.estado === "completada") o.ok++; else if (c.estado === "cancelada" || c.estado === "no_asistio") o.mal++; else o.act++; });
      const dias = Array.from({ length: 14 }, (_, i) => { const f = sumarDias(hoy, i - 13); const o = porDia[f] || { ok: 0, act: 0, mal: 0 }; return { f, dia: Number(f.slice(8)), hoy: f === hoy, ...o, total: o.ok + o.act + o.mal }; });
      const t30 = c30.data || [];
      const cerradas = t30.filter((c) => ["completada", "no_asistio", "cancelada"].includes(c.estado));
      const asistencia = cerradas.length ? Math.round((cerradas.filter((c) => c.estado === "completada").length / cerradas.length) * 100) : null;
      const citasHoy = t30.filter((c) => c.fecha === hoy);

      // Flujo de caja
      const flujo = meses6.map((k) => ({ k, label: MESES[Number(k.slice(5)) - 1], ing: 0, gas: 0 }));
      (abo6.data || []).forEach((a) => { const m = flujo.find((x) => x.k === (a.fecha || "").slice(0, 7)); if (m) m.ing += Number(a.monto) || 0; });
      (gas6.data || []).forEach((g) => { const m = flujo.find((x) => x.k === (g.fecha || "").slice(0, 7)); if (m) m.gas += Number(g.monto) || 0; });
      const mesActual = flujo[flujo.length - 1];
      const porCobrar = (car12.data || []).reduce((s, c) => s + Number(c.total || 0), 0) - (abo12.data || []).reduce((s, a) => s + Number(a.monto || 0), 0);

      const presLista = pres.data || [];
      const activos = presLista.filter((p) => p.estado === "pendiente" || p.estado === "aceptado");
      const stock = (ins.data || []).map((i) => ({ ...i, st: stockStatus(i) })).filter((i) => i.st !== "ok");
      const hoyStr = hoy;
      const labData = lab.data || [];

      setErrores(errs);
      setD({
        doctores, nDoc: doctores.length, nPac: nPac.count ?? 0, nPacMes: nPacMes.count ?? 0, sinConf: sinConf.count ?? 0, pacNombre,
        citasHoy, confHoy: citasHoy.filter((c) => c.estado === "confirmada").length, pendHoy: citasHoy.filter((c) => c.estado === "pendiente").length,
        prox: prox.data || [], dias, asistencia, flujo, mesActual, porCobrar,
        presActivos: activos.length, presMonto: activos.reduce((s, p) => s + totalPres(p), 0), aceptados: presLista.filter((p) => p.estado === "aceptado").length, presRecientes: presLista.slice(0, 6),
        stockCrit: stock.filter((i) => i.st === "critical"), stockBajo: stock.filter((i) => i.st === "low"),
        labListos: labData.filter((t) => t.estado === "listo").length, labAtras: labData.filter((t) => t.fecha_entrega && t.fecha_entrega < hoyStr).length, labActivos: labData.length,
      });
    })().catch((e) => { if (vivo) { setErrores([e.message || String(e)]); setD({}); } });
    return () => { vivo = false; };
  }, [cid, hoy, rolUi, profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const nombre = (profile?.nombre || "").split(" ")[0];
  const h = horaEnZona(timezone);
  const saludo = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
  const cargando = d === null;
  const nombreDoc = useMemo(() => Object.fromEntries((d?.doctores || []).map((x) => [x.id, x.nombre])), [d]);
  const alertas = d ? [
    d.sinConf > 0 && { n: d.sinConf, c: "a", t: "citas de mañana sin confirmar", s: "Confírmalas para reducir ausencias", mod: "notificaciones" },
    verLab && d.labAtras > 0 && { n: d.labAtras, c: "r", t: "trabajos de laboratorio atrasados", s: "Pasaron su fecha de entrega", mod: "laboratorio" },
    verLab && d.labListos > 0 && { n: d.labListos, c: "g", t: "trabajos listos para entregar", s: "Avisa al paciente", mod: "laboratorio" },
    verStock && d.stockCrit.length > 0 && { n: d.stockCrit.length, c: "r", t: "insumos en nivel crítico", s: d.stockCrit.slice(0, 3).map((i) => i.nombre).join(", "), mod: "inventario" },
    verStock && d.stockBajo.length > 0 && { n: d.stockBajo.length, c: "a", t: "insumos con stock bajo", s: d.stockBajo.slice(0, 3).map((i) => i.nombre).join(", "), mod: "inventario" },
    esClinico && d.aceptados > 0 && { n: d.aceptados, c: "t", t: "presupuestos aceptados por facturar", s: "Pendientes de cobro", mod: "presupuesto" },
  ].filter(Boolean) : [];

  if (!cid) return <div className="mod"><div className="card"><div className="empty"><div className="ic">🏥</div><div className="t">Sin clínica asociada</div><div className="s">Tu usuario no está vinculado a un consultorio.</div></div></div></div>;

  return (
    <div className="mod">
      <div className="dash-hi">
        <div>
          <div className="hi">{new Intl.DateTimeFormat("es-EC", { timeZone: timezone, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}</div>
          <div className="mh-t" style={{ fontSize: 24 }}>{saludo}{nombre ? `, ${nombre}` : ""} 👋</div>
          <div className="mh-s">{consultorio?.nombre || "Tu clínica"} · resumen de hoy</div>
        </div>
        {esClinico && <div className="qa"><button className="btn-sm" onClick={ir("calendario")}>+ Nueva cita</button><button className="btn-sm sec" onClick={ir("pacientes")}>+ Paciente</button><button className="btn-sm sec" onClick={ir("presupuesto")}>+ Presupuesto</button></div>}
      </div>

      {errores.length > 0 && <div className="card mb14"><div className="card-b txt-sm" style={{ color: "var(--rose)" }}>Algunos datos no se pudieron cargar ({errores.join(" · ")}). Las cifras podrían estar incompletas.</div></div>}
      {truncado && <div className="card mb14"><div className="card-b txt-sm" style={{ color: "var(--amber)" }}>Hay muchos registros: algunas sumas del periodo se calcularon con los 5.000 más recientes.</div></div>}

      <div className="kpi-row">
        <div className="kpi t"><div className="kpi-ic">📅</div><div className="kpi-v">{cargando ? "—" : d.citasHoy.length}</div><div className="kpi-l">{rolUi === "doctor" ? "Mis citas hoy" : "Citas hoy"}</div><div className="kpi-s">{cargando ? " " : `${d.confHoy} confirmadas · ${d.pendHoy} pendientes`}</div></div>
        <div className="kpi g"><div className="kpi-ic">👥</div><div className="kpi-v">{cargando ? "—" : d.nPac}</div><div className="kpi-l">Pacientes activos</div><div className="kpi-s">{cargando ? " " : `+${d.nPacMes} este mes`}</div></div>
        <div className="kpi b"><div className="kpi-ic">🩺</div><div className="kpi-v">{cargando ? "—" : d.nDoc}</div><div className="kpi-l">Doctores activos</div><div className="kpi-s">{cargando || d.asistencia === null ? " " : `Asistencia 30 d: ${d.asistencia}%`}</div></div>
        {esClinico && <div className="kpi r"><div className="kpi-ic">💰</div><div className="kpi-v">{cargando ? "—" : d.presActivos}</div><div className="kpi-l">Presupuestos activos</div><div className="kpi-s">{cargando ? " " : `${usd0(d.presMonto)} en propuestas`}</div></div>}
      </div>
      {verFinanzas && (
        <div className="kpi-row">
          <div className="kpi g"><div className="kpi-ic">💵</div><div className="kpi-v">{cargando ? "—" : usd0(d.mesActual.ing)}</div><div className="kpi-l">Cobrado este mes</div></div>
          <div className="kpi r"><div className="kpi-ic">🧾</div><div className="kpi-v">{cargando ? "—" : usd0(d.mesActual.gas)}</div><div className="kpi-l">Gastos este mes</div></div>
          <div className="kpi t"><div className="kpi-ic">📈</div><div className="kpi-v" style={{ color: !cargando && d.mesActual.ing - d.mesActual.gas < 0 ? "var(--rose)" : undefined }}>{cargando ? "—" : (d.mesActual.ing - d.mesActual.gas < 0 ? "−" : "") + usd0(Math.abs(d.mesActual.ing - d.mesActual.gas))}</div><div className="kpi-l">Resultado del mes</div></div>
          <div className="kpi b"><div className="kpi-ic">⏳</div><div className="kpi-v">{cargando ? "—" : usd0(d.porCobrar)}</div><div className="kpi-l">Por cobrar</div><div className="kpi-s">Cargos de los últimos 12 meses</div></div>
        </div>
      )}

      <div className="dash-grid">
        <div className="card">
          <div className="dpanel-h"><b>📊 Actividad de citas · últimos 14 días</b><button onClick={ir("calendario")}>Ver calendario →</button></div>
          {cargando ? <div className="sk" style={{ height: 190, margin: 16 }} /> : d.dias.every((x) => x.total === 0) ? <div className="empty"><div className="ic">📅</div><div className="t">Sin citas en estos días</div><div className="s">Cuando agendes citas, verás aquí su evolución diaria.</div></div> : (<><div className="chart-box"><ActividadChart dias={d.dias} /></div><div className="lg"><span><i style={{ background: "var(--green)" }} />Completadas</span><span><i style={{ background: "var(--teal)" }} />Agendadas / confirmadas</span><span><i style={{ background: "var(--rose)" }} />Canceladas / no asistió</span></div></>)}
        </div>

        <div className="card">
          <div className="dpanel-h"><b>⏭️ Próximas citas</b><button onClick={ir("calendario")}>Ver todas →</button></div>
          {cargando ? <div className="sk" style={{ height: 190, margin: 16 }} /> : d.prox.length === 0 ? <div className="empty"><div className="ic">🗓️</div><div className="t">Sin citas próximas</div><div className="s">No hay citas pendientes ni confirmadas a partir de hoy.</div></div> : d.prox.slice(0, 8).map((c) => (
            <div key={c.id} className="up-i">
              <div className="up-t">{(c.hora_inicio || "").slice(0, 5)}<small>{c.fecha === hoy ? "Hoy" : fmtFecha(c.fecha, { day: "2-digit", month: "short" })}</small></div>
              <div className="up-w"><b>{d.pacNombre[c.paciente_id] || "Paciente"}</b><span>{[c.motivo, nombreDoc[c.doctor_id]].filter(Boolean).join(" · ")}</span></div>
              <span className={"tag " + (TAG_CITA[c.estado] || "ta")}>{ESTADO_CITA[c.estado] || c.estado}</span>
            </div>
          ))}
        </div>
      </div>

      {esClinico && <div className="dash-grid">
        {verFinanzas ? (
          <div className="card">
            <div className="dpanel-h"><b>💳 Flujo de caja · últimos 6 meses</b><button onClick={ir("contabilidad")}>Contabilidad →</button></div>
            {cargando ? <div className="sk" style={{ height: 200, margin: 16 }} /> : (<><div className="chart-box"><FlujoChart meses={d.flujo} /></div><div className="lg"><span><i style={{ background: "var(--teal)" }} />Cobrado (abonos)</span><span><i style={{ background: "var(--rose)" }} />Gastos</span><span className="txt-muted">Bajo cada mes: resultado</span></div></>)}
          </div>
        ) : <div className="card"><div className="dpanel-h"><b>🔔 Alertas</b></div>{cargando ? <div className="sk" style={{ height: 120, margin: 16 }} /> : alertas.length === 0 ? <div className="empty"><div className="ic">✅</div><div className="t">Todo en orden</div></div> : alertas.map((a) => <div key={a.t} className="al" onClick={ir(a.mod)}><span className={"n " + a.c}>{a.n}</span><div><div className="fw6">{a.t}</div><small>{a.s}</small></div></div>)}</div>}

        <div style={{ display: "grid", gap: 16 }}>
          {verFinanzas && (
            <div className="card">
              <div className="dpanel-h"><b>🔔 Alertas</b></div>
              {cargando ? <div className="sk" style={{ height: 100, margin: 16 }} /> : alertas.length === 0 ? <div className="empty" style={{ padding: 26 }}><div className="ic">✅</div><div className="t">Todo en orden</div><div className="s" style={{ margin: 0 }}>Sin pendientes por atender.</div></div> : alertas.map((a) => <div key={a.t} className="al" onClick={ir(a.mod)}><span className={"n " + a.c}>{a.n}</span><div><div className="fw6">{a.t}</div><small>{a.s}</small></div></div>)}
            </div>
          )}
          {esClinico && (
            <div className="card">
              <div className="dpanel-h"><b>💰 Presupuestos recientes</b><button onClick={ir("presupuesto")}>Ver todos →</button></div>
              {cargando ? <div className="sk" style={{ height: 120, margin: 16 }} /> : d.presRecientes.length === 0 ? <div className="empty" style={{ padding: 26 }}><div className="ic">💰</div><div className="t">Aún no hay presupuestos</div></div> : d.presRecientes.map((p) => (
                <div key={p.id} className="up-i">
                  <div className="up-w"><b>{d.pacNombre[p.paciente_id] || "Paciente"}</b><span>{fmtFecha(p.fecha, { day: "2-digit", month: "short", year: "numeric" })}</span></div>
                  <span className={"tag " + (TAG_PRES[p.estado] || "ta")}>{p.estado}</span>
                  <span className="mono fw6" style={{ minWidth: 76, textAlign: "right" }}>{usd(totalPres(p))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>}
    </div>
  );
}
