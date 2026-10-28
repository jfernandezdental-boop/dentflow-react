import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { hoyISO, fmtFecha } from "../lib/format";
import "../styles/clinico.css";

const DIAS = [
  { n: 1, corto: "Lun", largo: "Lunes" }, { n: 2, corto: "Mar", largo: "Martes" }, { n: 3, corto: "Mié", largo: "Miércoles" },
  { n: 4, corto: "Jue", largo: "Jueves" }, { n: 5, corto: "Vie", largo: "Viernes" }, { n: 6, corto: "Sáb", largo: "Sábado" }, { n: 0, corto: "Dom", largo: "Domingo" },
];
const H0 = 7, H1 = 20, HH = 44; // horas visibles y alto de fila en px
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const min = (t) => { const [h, m] = (t || "00:00").split(":"); return +h * 60 + +m; };
const hhmm = (t) => (t || "").slice(0, 5);
function lunesDe(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
const addDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const topPx = (m) => ((m - H0 * 60) / 60) * HH;

function horarioInicial(horarios) {
  const por = Object.fromEntries((horarios || []).map((h) => [h.dia_semana, h]));
  return Object.fromEntries(DIAS.map((d) => [d.n, por[d.n] ? { activo: !!por[d.n].activo, ini: hhmm(por[d.n].hora_inicio), fin: hhmm(por[d.n].hora_fin) } : { activo: false, ini: "08:00", fin: "17:00" }]));
}

export default function Agenda() {
  const { profile, rolUi } = useAuth();
  const consultorioId = profile?.consultorio_id || null;
  const [doctores, setDoctores] = useState([]);
  const [docId, setDocId] = useState(null);
  const [semana, setSemana] = useState(() => lunesDe(new Date()));
  const [horarios, setHorarios] = useState([]);
  const [bloqueos, setBloqueos] = useState([]);
  const [citas, setCitas] = useState([]);
  const [futuras, setFuturas] = useState([]);
  const [pacNombre, setPacNombre] = useState({});
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState(horarioInicial([]));
  const [bk, setBk] = useState({ desde: hoyISO(), hasta: hoyISO(), motivo: "" });
  const [msg, setMsg] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const hoy = hoyISO();

  useEffect(() => {
    if (!consultorioId) { setLoading(false); return; }
    supabase.from("doctores").select("id,nombre,especialidad,color,profile_id").eq("consultorio_id", consultorioId).eq("activo", true).order("nombre").then(({ data }) => {
      const lista = data || [];
      setDoctores(lista);
      const propio = lista.find((d) => d.profile_id && d.profile_id === profile?.id);
      setDocId((propio || lista[0])?.id || null);
      if (!lista.length) setLoading(false);
    });
  }, [consultorioId, profile?.id]);

  const doctor = doctores.find((d) => d.id === docId) || null;
  const puedeEditar = rolUi === "admin" || (rolUi === "doctor" && !!doctor?.profile_id && doctor.profile_id === profile?.id);

  const fechasSemana = useMemo(() => Array.from({ length: 7 }, (_, i) => addDias(semana, i)), [semana]);

  async function cargar() {
    if (!docId) return;
    setLoading(true);
    const desde = iso(semana), hasta = iso(addDias(semana, 6));
    const [h, b, c, f] = await Promise.all([
      supabase.from("doctor_horarios").select("*").eq("doctor_id", docId),
      supabase.from("doctor_bloqueos").select("*").eq("doctor_id", docId).gte("fecha", iso(addDias(new Date(), -1))).order("fecha"),
      supabase.from("citas").select("id,fecha,hora_inicio,hora_fin,motivo,estado,paciente_id").eq("doctor_id", docId).gte("fecha", desde).lte("fecha", hasta).not("estado", "in", "(cancelada,no_asistio)"),
      supabase.from("citas").select("id,fecha,hora_inicio,hora_fin,estado").eq("doctor_id", docId).gte("fecha", hoyISO()).not("estado", "in", "(cancelada,no_asistio)").limit(500),
    ]);
    setHorarios(h.data || []); setBloqueos(b.data || []); setCitas(c.data || []); setFuturas(f.data || []);
    setEditor(horarioInicial(h.data));
    const ids = [...new Set((c.data || []).map((x) => x.paciente_id).filter(Boolean))];
    if (ids.length) {
      const { data: ps } = await supabase.from("pacientes").select("id,nombre").in("id", ids);
      setPacNombre(Object.fromEntries((ps || []).map((p) => [p.id, p.nombre])));
    }
    setLoading(false);
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [docId, semana]);

  const horarioPorDia = useMemo(() => Object.fromEntries(horarios.filter((h) => h.activo).map((h) => [h.dia_semana, h])), [horarios]);
  const bloqueadas = useMemo(() => new Map(bloqueos.map((b) => [b.fecha, b.motivo || "Bloqueado"])), [bloqueos]);

  const kpis = useMemo(() => {
    const minDisp = horarios.filter((h) => h.activo).reduce((s, h) => s + (min(h.hora_fin) - min(h.hora_inicio)), 0);
    const minCitas = citas.reduce((s, c) => s + Math.max(0, min(c.hora_fin) - min(c.hora_inicio)), 0);
    const prox30 = bloqueos.filter((b) => b.fecha >= hoy && b.fecha <= iso(addDias(new Date(), 30))).length;
    return { horas: (minDisp / 60).toFixed(minDisp % 60 ? 1 : 0), citas: citas.length, ocup: minDisp ? Math.min(100, Math.round((minCitas / minDisp) * 100)) : 0, prox30 };
  }, [horarios, citas, bloqueos, hoy]);

  // Citas futuras que quedarían fuera del horario que se está editando
  const conflictos = useMemo(() => futuras.filter((c) => {
    const e = editor[new Date(c.fecha + "T00:00:00").getDay()];
    return !e || !e.activo || min(c.hora_inicio) < min(e.ini) || min(c.hora_fin) > min(e.fin);
  }).length, [futuras, editor]);

  const setDia = (n, k, v) => setEditor((e) => ({ ...e, [n]: { ...e[n], [k]: v } }));
  function copiarLV() { const base = editor[1]; setEditor((e) => ({ ...e, ...Object.fromEntries([2, 3, 4, 5].map((n) => [n, { ...base }])) })); }

  async function guardarHorario() {
    for (const d of DIAS) { const e = editor[d.n]; if (e.activo && min(e.fin) <= min(e.ini)) return setMsg({ t: "err", txt: `${d.largo}: la hora de fin debe ser posterior a la de inicio.` }); }
    setGuardando(true); setMsg(null);
    const filas = DIAS.map((d) => ({ doctor_id: docId, dia_semana: d.n, activo: editor[d.n].activo, hora_inicio: editor[d.n].ini, hora_fin: editor[d.n].fin }));
    const { error } = await supabase.from("doctor_horarios").upsert(filas, { onConflict: "doctor_id,dia_semana" });
    setGuardando(false);
    if (error) return setMsg({ t: "err", txt: "No se pudo guardar: " + error.message });
    setMsg({ t: "ok", txt: "Horario guardado ✓" });
    cargar();
  }

  async function agregarBloqueo() {
    if (!bk.desde || !bk.hasta || bk.hasta < bk.desde) return setMsg({ t: "err", txt: "Revisa las fechas del bloqueo." });
    const fechas = [];
    for (let d = new Date(bk.desde + "T00:00:00"); iso(d) <= bk.hasta && fechas.length < 91; d = addDias(d, 1)) fechas.push(iso(d));
    if (fechas.length > 90) return setMsg({ t: "err", txt: "El bloqueo no puede superar 90 días." });
    const nuevas = fechas.filter((f) => !bloqueadas.has(f));
    if (!nuevas.length) return setMsg({ t: "err", txt: "Esas fechas ya están bloqueadas." });
    setGuardando(true); setMsg(null);
    const { error } = await supabase.from("doctor_bloqueos").insert(nuevas.map((fecha) => ({ doctor_id: docId, fecha, motivo: bk.motivo.trim() || null })));
    setGuardando(false);
    if (error) return setMsg({ t: "err", txt: "No se pudo bloquear: " + error.message });
    setMsg({ t: "ok", txt: `${nuevas.length} día${nuevas.length === 1 ? "" : "s"} bloqueado${nuevas.length === 1 ? "" : "s"} ✓` });
    setBk({ desde: hoyISO(), hasta: hoyISO(), motivo: "" });
    cargar();
  }
  async function quitarBloqueos(ids) {
    const { error } = await supabase.from("doctor_bloqueos").delete().in("id", ids);
    if (error) return setMsg({ t: "err", txt: "No se pudo quitar: " + error.message });
    cargar();
  }

  // Agrupa bloqueos consecutivos con el mismo motivo en rangos
  const rangos = useMemo(() => {
    const out = [];
    bloqueos.filter((b) => b.fecha >= hoy).forEach((b) => {
      const ult = out[out.length - 1];
      if (ult && (ult.motivo || "") === (b.motivo || "") && iso(addDias(new Date(ult.hasta + "T00:00:00"), 1)) === b.fecha) { ult.hasta = b.fecha; ult.ids.push(b.id); }
      else out.push({ desde: b.fecha, hasta: b.fecha, motivo: b.motivo, ids: [b.id] });
    });
    return out;
  }, [bloqueos, hoy]);

  if (!consultorioId) return <div className="pgm"><div className="card"><div className="empty"><div className="ic">🏥</div><div className="t">Sin clínica asociada</div></div></div></div>;

  const alto = (H1 - H0) * HH;
  return (
    <div className="pgm">
      <div className="mh">
        <div><div className="mh-t">🗓️ Agenda por doctor</div><div className="mh-s">Disponibilidad semanal, citas del día a día y bloqueos por vacaciones o permisos</div></div>
      </div>

      {doctores.length === 0 && !loading ? (
        <div className="card"><div className="empty"><div className="ic">🩺</div><div className="t">Aún no hay doctores</div><div className="s">Agrega doctores a la clínica para configurar su agenda.</div></div></div>
      ) : (
        <>
          <div className="dsel">
            {doctores.map((d) => <button key={d.id} type="button" className={d.id === docId ? "on" : ""} onClick={() => setDocId(d.id)}><i style={{ background: d.color || "var(--teal)" }} />{d.nombre}{d.especialidad ? <small style={{ color: "var(--muted)", fontWeight: 500 }}>· {d.especialidad}</small> : null}</button>)}
          </div>

          <div className="kpi-row">
            <div className="kpi t"><div className="kpi-ic">⏱️</div><div className="kpi-v">{kpis.horas} h</div><div className="kpi-l">Disponibles por semana</div></div>
            <div className="kpi g"><div className="kpi-ic">📅</div><div className="kpi-v">{kpis.citas}</div><div className="kpi-l">Citas esta semana</div></div>
            <div className="kpi b"><div className="kpi-ic">📈</div><div className="kpi-v">{kpis.ocup}%</div><div className="kpi-l">Ocupación semanal</div></div>
            <div className="kpi r"><div className="kpi-ic">⛔</div><div className="kpi-v">{kpis.prox30}</div><div className="kpi-l">Días bloqueados (30 d)</div></div>
          </div>

          <div className="ag-wrap">
            <div>
              <div className="ag-nav">
                <button className="btn-sm sec" onClick={() => setSemana(addDias(semana, -7))}>‹</button>
                <div className="rng">{fmtFecha(iso(semana), { day: "numeric", month: "short" })} – {fmtFecha(iso(addDias(semana, 6)), { day: "numeric", month: "short", year: "numeric" })}</div>
                <button className="btn-sm sec" onClick={() => setSemana(addDias(semana, 7))}>›</button>
                <button className="btn-sm sec" onClick={() => setSemana(lunesDe(new Date()))}>Hoy</button>
                <span className="txt-muted" style={{ marginLeft: "auto" }}>🟩 disponible · 🟦 cita · 🟧 por confirmar · ▨ bloqueado</span>
              </div>
              {loading ? <div className="sk" style={{ height: 420 }} /> : (
                <div className="ag-grid" style={{ "--hh": HH + "px" }}>
                  <div className="ag-h" />
                  {fechasSemana.map((d) => <div key={iso(d)} className={"ag-h" + (iso(d) === hoy ? " hoy" : "")}>{DIAS.find((x) => x.n === d.getDay()).corto}<small>{d.getDate()}</small></div>)}
                  <div className="ag-hrs" style={{ height: alto }}>{Array.from({ length: H1 - H0 + 1 }, (_, i) => <span key={i} style={{ top: i * HH }}>{pad(H0 + i)}:00</span>)}</div>
                  {fechasSemana.map((d) => {
                    const f = iso(d), h = horarioPorDia[d.getDay()], bloq = bloqueadas.get(f);
                    return (
                      <div key={f} className="ag-col" style={{ height: alto }}>
                        {h && !bloq && <div className="ag-av" style={{ top: topPx(min(h.hora_inicio)), height: topPx(min(h.hora_fin)) - topPx(min(h.hora_inicio)) }} />}
                        {bloq && <div className="ag-bk">⛔ {bloq}</div>}
                        {citas.filter((c) => c.fecha === f).map((c) => {
                          const t = topPx(min(c.hora_inicio)), hgt = Math.max(20, topPx(min(c.hora_fin)) - t);
                          return <div key={c.id} className={"ag-ev" + (c.estado === "pendiente" ? " pend" : "")} style={{ top: t, height: hgt }} title={`${hhmm(c.hora_inicio)}–${hhmm(c.hora_fin)} · ${c.motivo || ""}`}><b>{pacNombre[c.paciente_id] || "Paciente"}</b>{hhmm(c.hora_inicio)} {c.motivo || ""}</div>;
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              <div className="card"><div className="card-b">
                <div className="sec-t">Horario semanal{!puedeEditar && " (solo lectura)"}</div>
                {DIAS.map((d) => { const e = editor[d.n]; return (
                  <div key={d.n} className={"hd-row" + (e.activo ? "" : " off")}>
                    <label><input type="checkbox" disabled={!puedeEditar} checked={e.activo} onChange={(x) => setDia(d.n, "activo", x.target.checked)} />{d.corto}</label>
                    <input className="fi sm mono" type="time" disabled={!puedeEditar || !e.activo} value={e.ini} onChange={(x) => setDia(d.n, "ini", x.target.value)} />
                    <input className="fi sm mono" type="time" disabled={!puedeEditar || !e.activo} value={e.fin} onChange={(x) => setDia(d.n, "fin", x.target.value)} />
                  </div>); })}
                {conflictos > 0 && <div className="warn-box" style={{ marginTop: 8 }}><span>⚠️</span><span>{conflictos} cita{conflictos === 1 ? "" : "s"} futura{conflictos === 1 ? "" : "s"} quedaría{conflictos === 1 ? "" : "n"} fuera de este horario. No se cancelan solas: reagéndalas en Citas.</span></div>}
                {puedeEditar && <div className="flex gap8" style={{ marginTop: 10, flexWrap: "wrap" }}><button className="btn-sm" type="button" onClick={guardarHorario} disabled={guardando}>{guardando ? "Guardando…" : "💾 Guardar horario"}</button><button className="btn-sm sec" type="button" onClick={copiarLV}>Copiar lunes a mar–vie</button></div>}
              </div></div>

              <div className="card"><div className="card-b">
                <div className="sec-t">Bloqueos y vacaciones</div>
                {puedeEditar && (<>
                  <div className="cg2"><div className="fl"><label>Desde</label><input className="fi sm" type="date" value={bk.desde} onChange={(e) => setBk({ ...bk, desde: e.target.value, hasta: bk.hasta < e.target.value ? e.target.value : bk.hasta })} /></div><div className="fl"><label>Hasta</label><input className="fi sm" type="date" min={bk.desde} value={bk.hasta} onChange={(e) => setBk({ ...bk, hasta: e.target.value })} /></div></div>
                  <div className="fl" style={{ marginBottom: 10 }}><input className="fi sm" placeholder="Motivo (vacaciones, congreso…)" value={bk.motivo} onChange={(e) => setBk({ ...bk, motivo: e.target.value })} /></div>
                  <button className="btn-sm sec" type="button" style={{ marginBottom: 12 }} onClick={agregarBloqueo} disabled={guardando}>+ Bloquear fechas</button>
                </>)}
                {rangos.length === 0 ? <div className="txt-muted">Sin bloqueos próximos.</div> : rangos.map((r) => (
                  <div key={r.ids[0]} className="bk-i"><span><b>{r.desde === r.hasta ? fmtFecha(r.desde, { day: "numeric", month: "short" }) : `${fmtFecha(r.desde, { day: "numeric", month: "short" })} → ${fmtFecha(r.hasta, { day: "numeric", month: "short" })}`}</b>{r.motivo ? ` · ${r.motivo}` : ""}</span>{puedeEditar && <button type="button" title="Quitar" onClick={() => quitarBloqueos(r.ids)}>✕</button>}</div>
                ))}
              </div></div>
              {msg && <div className="txt-sm fw6" style={{ color: msg.t === "ok" ? "var(--green)" : "var(--rose)" }}>{msg.txt}</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
