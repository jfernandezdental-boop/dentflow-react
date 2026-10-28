import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { hoyISO, fmtFecha, edadDesde } from "../lib/format";
import "../styles/clinico.css";

const SANGRE = ["", "O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-", "Desconocido"];
const SEXO = { F: "Femenino", M: "Masculino", otro: "Otro" };
const TABS = [["sesiones", "🕒 Sesiones"], ["resumen", "🩺 Resumen clínico"], ["notas", "📝 Notas"], ["odonto", "🦷 Odontograma"], ["trat", "💰 Tratamientos"], ["doctor", "👨‍⚕️ Doctor"]];
const usd = (n) => "$" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const iniciales = (n) => (n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join("");
const totalPresupuesto = (p) => {
  const neto = (p.presupuesto_items || []).reduce((s, it) => s + (Number(it.precio) || 0) * (1 - (Number(it.descuento) || 0) / 100), 0);
  return neto * (1 - (Number(p.descuento_pct) || 0) / 100);
};
const ESTADO_CITA = { pendiente: "Pendiente", confirmada: "Confirmada", completada: "Completada", cancelada: "Cancelada", no_asistio: "No asistió" };
const TAG_PRES = { pendiente: "ta", aceptado: "tg", cobrado: "tg" };

function NotaModal({ nota, paciente, doctores, citas, consultorioId, userId, canDelete, onClose, onSaved }) {
  const [f, setF] = useState(() => ({
    fecha: nota?.fecha || hoyISO(), doctor_id: nota?.doctor_id || paciente.doctor_id || "", cita_id: nota?.cita_id || "",
    motivo: nota?.motivo || "", diagnostico: nota?.diagnostico || "", tratamiento: nota?.tratamiento || "", piezas: nota?.piezas || "",
    indicaciones: nota?.indicaciones || "", estado: nota?.estado || "completada",
    link_odonto: !!nota?.link_odonto, link_receta: !!nota?.link_receta, link_presupuesto: !!nota?.link_presupuesto,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  async function guardar() {
    if (!f.motivo.trim()) return setError("Indica el motivo de la sesión.");
    if (!f.fecha) return setError("Indica la fecha.");
    setSaving(true); setError("");
    const t = (v) => (v.trim() ? v.trim() : null);
    const payload = { fecha: f.fecha, doctor_id: f.doctor_id || null, cita_id: f.cita_id || null, motivo: f.motivo.trim(), diagnostico: t(f.diagnostico), tratamiento: t(f.tratamiento), piezas: t(f.piezas), indicaciones: t(f.indicaciones), estado: f.estado, link_odonto: f.link_odonto, link_receta: f.link_receta, link_presupuesto: f.link_presupuesto };
    const res = nota ? await supabase.from("notas_clinicas").update(payload).eq("id", nota.id) : await supabase.from("notas_clinicas").insert({ ...payload, consultorio_id: consultorioId, paciente_id: paciente.id, creado_por: userId });
    setSaving(false);
    if (res.error) return setError("No se pudo guardar: " + res.error.message);
    onSaved();
  }
  async function eliminar() {
    if (!window.confirm("¿Eliminar esta nota clínica? No se puede deshacer.")) return;
    const { error: err } = await supabase.from("notas_clinicas").delete().eq("id", nota.id);
    if (err) return setError("No se pudo eliminar: " + err.message);
    onSaved();
  }
  return (
    <div className="appt-modal on" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="appt-box" style={{ width: 580 }}>
        <div className="appt-box-title">{nota ? "✏️ Editar nota clínica" : "📝 Nueva sesión clínica"}</div>
        <div className="appt-box-sub">{paciente.nombre}</div>
        <div className="cg3">
          <div className="fl"><label>Fecha *</label><input className="fi sm" type="date" value={f.fecha} onChange={(e) => set("fecha", e.target.value)} /></div>
          <div className="fl"><label>Doctor</label><select className="fi sm" value={f.doctor_id} onChange={(e) => set("doctor_id", e.target.value)}><option value="">—</option>{doctores.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}</select></div>
          <div className="fl"><label>Estado</label><select className="fi sm" value={f.estado} onChange={(e) => set("estado", e.target.value)}><option value="completada">Completada</option><option value="en_curso">En curso</option><option value="pendiente">Pendiente</option></select></div>
        </div>
        <div className="fl" style={{ marginBottom: 12 }}><label>Cita asociada (opcional)</label><select className="fi sm" value={f.cita_id} onChange={(e) => set("cita_id", e.target.value)}><option value="">Ninguna</option>{citas.map((c) => <option key={c.id} value={c.id}>{fmtFecha(c.fecha, { day: "2-digit", month: "short", year: "numeric" })} · {c.motivo || "Cita"}</option>)}</select></div>
        <div className="fl" style={{ marginBottom: 12 }}><label>Motivo de la sesión *</label><input className="fi sm" value={f.motivo} onChange={(e) => set("motivo", e.target.value)} /></div>
        <div className="cg2">
          <div className="fl"><label>Diagnóstico</label><textarea className="fi sm" rows={2} value={f.diagnostico} onChange={(e) => set("diagnostico", e.target.value)} /></div>
          <div className="fl"><label>Tratamiento realizado</label><textarea className="fi sm" rows={2} value={f.tratamiento} onChange={(e) => set("tratamiento", e.target.value)} /></div>
        </div>
        <div className="cg2">
          <div className="fl"><label>Piezas</label><input className="fi sm mono" placeholder="36, 37" value={f.piezas} onChange={(e) => set("piezas", e.target.value)} /></div>
          <div className="fl"><label>Indicaciones al paciente</label><input className="fi sm" value={f.indicaciones} onChange={(e) => set("indicaciones", e.target.value)} /></div>
        </div>
        <div className="ck-grid" style={{ marginBottom: 12 }}>
          <label className="ck"><input type="checkbox" checked={f.link_odonto} onChange={(e) => set("link_odonto", e.target.checked)} /> Se actualizó el odontograma</label>
          <label className="ck"><input type="checkbox" checked={f.link_receta} onChange={(e) => set("link_receta", e.target.checked)} /> Se emitió receta</label>
          <label className="ck"><input type="checkbox" checked={f.link_presupuesto} onChange={(e) => set("link_presupuesto", e.target.checked)} /> Genera / modifica presupuesto</label>
        </div>
        {error && <div className="txt-sm" style={{ color: "var(--rose)", marginBottom: 10 }}>{error}</div>}
        <div className="flex gap8" style={{ justifyContent: "space-between" }}>
          <div>{nota && canDelete && <button className="btn-sm danger" type="button" onClick={eliminar} disabled={saving}>🗑 Eliminar</button>}</div>
          <div className="flex gap8"><button className="btn-sm sec" type="button" onClick={onClose} disabled={saving}>Cancelar</button><button className="btn-sm" type="button" onClick={guardar} disabled={saving}>{saving ? "Guardando…" : "💾 Guardar"}</button></div>
        </div>
      </div>
    </div>
  );
}

export default function HistoriaClinica({ irA }) {
  const { profile, rolUi } = useAuth();
  const consultorioId = profile?.consultorio_id || null;
  const esAdmin = rolUi === "admin";
  const puedeEscribirNotas = ["admin", "doctor", "recepcionista"].includes(rolUi);
  const [lista, setLista] = useState([]);
  const [doctores, setDoctores] = useState([]);
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [pid, setPid] = useState(null);
  const [d, setD] = useState(null); // datos del paciente seleccionado
  const [cargando, setCargando] = useState(false);
  const [errorCarga, setErrorCarga] = useState("");
  const [tab, setTab] = useState("sesiones");
  const [filtro, setFiltro] = useState("all");
  const [notaModal, setNotaModal] = useState(null); // {nota|null}
  const [res, setRes] = useState({ alergias: "", tipoSangre: "", medicamentos: "", enfermedades: "", antecedentes: "", observaciones: "" });
  const [msgRes, setMsgRes] = useState(null);
  const [reasig, setReasig] = useState({ doctor: "", motivo: "" });
  const [msgDoc, setMsgDoc] = useState(null);

  useEffect(() => {
    if (!consultorioId) return;
    Promise.all([
      supabase.from("pacientes").select("id,nombre,cedula").eq("consultorio_id", consultorioId).eq("activo", true).order("nombre").limit(1500),
      supabase.from("doctores").select("id,nombre").eq("consultorio_id", consultorioId).order("nombre"),
    ]).then(([p, dc]) => { setLista(p.data || []); setDoctores(dc.data || []); });
  }, [consultorioId]);

  const nombreDoc = useMemo(() => Object.fromEntries(doctores.map((x) => [x.id, x.nombre])), [doctores]);
  const sugerencias = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (t ? lista.filter((p) => p.nombre.toLowerCase().includes(t) || (p.cedula || "").includes(t)) : lista).slice(0, 8);
  }, [lista, q]);

  async function cargarPaciente(id) {
    setCargando(true); setErrorCarga("");
    const [p, c, n, r, a, pr, cg, lg] = await Promise.all([
      supabase.from("pacientes").select("*").eq("id", id).single(),
      supabase.from("citas").select("id,fecha,hora_inicio,estado,motivo,doctor_id").eq("paciente_id", id).order("fecha", { ascending: false }).limit(150),
      supabase.from("notas_clinicas").select("*").eq("paciente_id", id).order("fecha", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("recetas").select("id,numero,fecha,diagnostico_desc,diagnostico_cie10,profesional").eq("paciente_id", id).order("fecha", { ascending: false }),
      supabase.from("atenciones_odontologicas").select("id,fecha,hora,doctor_id,observaciones_odontograma").eq("paciente_id", id).order("fecha", { ascending: false }).order("hora", { ascending: false }),
      supabase.from("presupuestos").select("*, presupuesto_items(nombre,pieza,precio,descuento)").eq("paciente_id", id).order("fecha", { ascending: false }),
      supabase.from("cargos").select("id,fecha,procedimiento,total,presupuesto_id, abonos(monto)").eq("paciente_id", id).order("fecha", { ascending: false }),
      supabase.from("pacientes_doctor_log").select("*").eq("paciente_id", id).order("fecha", { ascending: false }),
    ]);
    const err = [p, c, n, r, a, pr, cg, lg].find((x) => x.error);
    if (err) setErrorCarga(err.error.message);
    const pac = p.data;
    let piezasPorAtencion = {};
    if ((a.data || []).length) {
      const { data: regs } = await supabase.from("odontograma_registros").select("atencion_id").in("atencion_id", a.data.map((x) => x.id));
      (regs || []).forEach((x) => { piezasPorAtencion[x.atencion_id] = (piezasPorAtencion[x.atencion_id] || 0) + 1; });
    }
    setD({ pac, citas: c.data || [], notas: n.data || [], recetas: r.data || [], atenciones: a.data || [], presupuestos: pr.data || [], cargos: cg.data || [], log: lg.data || [], piezasPorAtencion });
    if (pac) {
      const cl = pac.clinico || {};
      setRes({ alergias: pac.alergias || "", tipoSangre: cl.tipoSangre || "", medicamentos: cl.medicamentos || "", enfermedades: cl.enfermedades || "", antecedentes: cl.antecedentes || "", observaciones: cl.observaciones || "" });
      setReasig({ doctor: "", motivo: "" });
    }
    setMsgRes(null); setMsgDoc(null); setCargando(false);
  }
  useEffect(() => { if (pid) cargarPaciente(pid); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [pid]);

  const timeline = useMemo(() => {
    if (!d) return [];
    const it = [];
    d.citas.forEach((c) => it.push({ k: "cita", ic: "📅", f: c.fecha, h: (c.hora_inicio || "").slice(0, 5), t: `Cita · ${ESTADO_CITA[c.estado] || c.estado}`, b: [c.motivo, nombreDoc[c.doctor_id]].filter(Boolean).join(" — ") }));
    d.notas.forEach((n) => it.push({ k: "nota", ic: "📝", f: n.fecha, h: "", t: `Sesión clínica · ${n.motivo}`, b: [n.diagnostico && "Dx: " + n.diagnostico, n.tratamiento && "Tx: " + n.tratamiento, n.piezas && "Piezas: " + n.piezas, n.indicaciones && "Indicaciones: " + n.indicaciones].filter(Boolean).join("\n"), nota: n }));
    d.recetas.forEach((r) => it.push({ k: "receta", ic: "💊", f: r.fecha, h: "", t: `Receta ${r.numero}`, b: [r.diagnostico_cie10, r.diagnostico_desc].filter(Boolean).join(" — ") }));
    d.atenciones.forEach((a) => it.push({ k: "odonto", ic: "🦷", f: a.fecha, h: (a.hora || "").slice(0, 5), t: "Revisión de odontograma", b: [`${d.piezasPorAtencion[a.id] || 0} piezas registradas`, a.observaciones_odontograma].filter(Boolean).join(" — ") }));
    return it.sort((x, y) => (y.f + (y.h || "")).localeCompare(x.f + (x.h || "")));
  }, [d, nombreDoc]);

  const stats = useMemo(() => d && ({ citas: d.citas.length, notas: d.notas.length, recetas: d.recetas.length, rev: d.atenciones.length }), [d]);
  const fin = useMemo(() => {
    if (!d) return null;
    const pagadoPorCargo = (c) => (c.abonos || []).reduce((s, a) => s + Number(a.monto || 0), 0);
    const cargado = d.cargos.reduce((s, c) => s + Number(c.total || 0), 0);
    const pagado = d.cargos.reduce((s, c) => s + pagadoPorCargo(c), 0);
    return { cargado, pagado, saldo: cargado - pagado, pagadoPorCargo };
  }, [d]);

  async function guardarResumen() {
    setMsgRes(null);
    const clinico = { ...(d.pac.clinico || {}), tipoSangre: res.tipoSangre, medicamentos: res.medicamentos.trim(), enfermedades: res.enfermedades.trim(), antecedentes: res.antecedentes.trim(), observaciones: res.observaciones.trim() };
    const { error } = await supabase.from("pacientes").update({ alergias: res.alergias.trim() || null, clinico }).eq("id", d.pac.id);
    if (error) return setMsgRes({ t: "err", txt: "No se pudo guardar: " + error.message });
    setD((s) => ({ ...s, pac: { ...s.pac, alergias: res.alergias.trim() || null, clinico } }));
    setMsgRes({ t: "ok", txt: "Resumen clínico guardado ✓" });
  }

  async function reasignar() {
    setMsgDoc(null);
    if (!reasig.doctor) return setMsgDoc({ t: "err", txt: "Selecciona el nuevo doctor." });
    if (reasig.doctor === d.pac.doctor_id) return setMsgDoc({ t: "err", txt: "Ese ya es el doctor asignado." });
    const { error } = await supabase.from("pacientes").update({ doctor_id: reasig.doctor }).eq("id", d.pac.id);
    if (error) return setMsgDoc({ t: "err", txt: "No se pudo reasignar: " + error.message });
    const lg = await supabase.from("pacientes_doctor_log").insert({ consultorio_id: consultorioId, paciente_id: d.pac.id, doctor_anterior_id: d.pac.doctor_id || null, doctor_nuevo_id: reasig.doctor, motivo: reasig.motivo.trim() || null, realizado_por: profile?.nombre || null });
    setMsgDoc(lg.error ? { t: "err", txt: "Doctor reasignado, pero no se pudo registrar en el historial: " + lg.error.message } : { t: "ok", txt: "Doctor reasignado ✓" });
    cargarPaciente(d.pac.id);
  }

  if (!consultorioId) return <div className="pgm"><div className="card"><div className="empty"><div className="ic">🏥</div><div className="t">Sin clínica asociada</div></div></div></div>;
  const pac = d?.pac;

  return (
    <div className="pgm">
      <div className="mh">
        <div><div className="mh-t">🗂️ Historia clínica</div><div className="mh-s">Todo el recorrido del paciente en un solo lugar: sesiones, antecedentes, odontograma y tratamientos</div></div>
      </div>

      <div style={{ position: "relative", maxWidth: 460, marginBottom: 16 }}>
        <input className="fi" placeholder="🔎 Buscar paciente por nombre o cédula…" value={q} onChange={(e) => { setQ(e.target.value); setAbierto(true); }} onFocus={() => setAbierto(true)} onBlur={() => setTimeout(() => setAbierto(false), 150)} />
        {abierto && sugerencias.length > 0 && (
          <div className="card" style={{ position: "absolute", left: 0, right: 0, top: "100%", marginTop: 4, zIndex: 20, overflow: "hidden" }}>
            {sugerencias.map((p) => <div key={p.id} className="rx-hist-i" style={{ padding: "10px 14px" }} onMouseDown={() => { setPid(p.id); setQ(p.nombre); setAbierto(false); setTab("sesiones"); }}><div style={{ flex: 1 }}><div className="fw6">{p.nombre}</div><div className="txt-muted mono">{p.cedula || "Sin cédula"}</div></div></div>)}
          </div>
        )}
      </div>

      {!pid ? (
        <div className="card"><div className="empty"><div className="ic">🗂️</div><div className="t">Elige un paciente</div><div className="s">Busca por nombre o cédula para ver su historia clínica completa.</div></div></div>
      ) : cargando || !pac ? <div className="sk" style={{ height: 320 }} /> : (
        <>
          {errorCarga && <div className="card mb14"><div className="card-b txt-sm" style={{ color: "var(--rose)" }}>Algunos datos no se pudieron cargar: {errorCarga}</div></div>}
          <div className="hc-head">
            <div className="av">{iniciales(pac.nombre)}</div>
            <div>
              <div className="mh-t" style={{ fontSize: 19 }}>{pac.nombre}</div>
              <div className="txt-muted">{[pac.cedula && "CI " + pac.cedula, edadDesde(pac.fecha_nac) && edadDesde(pac.fecha_nac) + " años", SEXO[pac.genero], pac.telefono].filter(Boolean).join(" · ")}</div>
              <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {pac.alergias ? <span className="due late">⚠️ Alergias: {pac.alergias}</span> : <span className="due ok">Sin alergias registradas</span>}
                <span className="due none">👨‍⚕️ {nombreDoc[pac.doctor_id] || "Sin doctor asignado"}</span>
              </div>
            </div>
            <div className="hc-st">
              <div><b>{stats.citas}</b><span>Citas</span></div><div><b>{stats.notas}</b><span>Notas</span></div><div><b>{stats.recetas}</b><span>Recetas</span></div><div><b>{stats.rev}</b><span>Revisiones</span></div>
            </div>
          </div>

          <div className="cal-view-toggle" style={{ marginBottom: 14, flexWrap: "wrap" }} role="tablist">
            {TABS.map(([v, l]) => <button key={v} type="button" className={"cvt-btn" + (tab === v ? " on" : "")} onClick={() => setTab(v)}>{l}</button>)}
          </div>

          {tab === "sesiones" && (
            <>
              <div className="chips" style={{ marginBottom: 12 }}>
                {[["all", "Todo"], ["cita", "📅 Citas"], ["nota", "📝 Sesiones"], ["receta", "💊 Recetas"], ["odonto", "🦷 Odontograma"]].map(([v, l]) => <button key={v} type="button" className={"chip" + (filtro === v ? " on" : "")} onClick={() => setFiltro(v)}>{l}</button>)}
              </div>
              {timeline.filter((x) => filtro === "all" || x.k === filtro).length === 0 ? <div className="card"><div className="empty"><div className="ic">🕒</div><div className="t">Sin movimientos todavía</div><div className="s">Las citas, sesiones, recetas y revisiones del odontograma de este paciente aparecerán aquí.</div></div></div> : (
                <div className="tlv">
                  {timeline.filter((x) => filtro === "all" || x.k === filtro).map((x, i) => (
                    <div key={i} className="tlv-i" data-ic={x.ic}>
                      <div className="tlv-t"><b>{x.t}</b><span className="tlv-d">{fmtFecha(x.f, { day: "2-digit", month: "short", year: "numeric" })}{x.h ? " · " + x.h : ""}</span></div>
                      {x.b && <div className="tlv-b">{x.b}</div>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "resumen" && (
            <div className="card"><div className="card-b">
              <div className="cg2">
                <div className="fl"><label>⚠️ Alergias</label><textarea className="fi sm" rows={2} placeholder="Penicilina, látex, anestésicos…" value={res.alergias} onChange={(e) => setRes({ ...res, alergias: e.target.value })} /></div>
                <div className="fl"><label>Tipo de sangre</label><select className="fi sm" value={res.tipoSangre} onChange={(e) => setRes({ ...res, tipoSangre: e.target.value })}>{SANGRE.map((s) => <option key={s} value={s}>{s || "—"}</option>)}</select></div>
              </div>
              <div className="cg2">
                <div className="fl"><label>Medicamentos actuales</label><textarea className="fi sm" rows={3} value={res.medicamentos} onChange={(e) => setRes({ ...res, medicamentos: e.target.value })} /></div>
                <div className="fl"><label>Enfermedades sistémicas</label><textarea className="fi sm" rows={3} placeholder="Diabetes, hipertensión, cardiopatías…" value={res.enfermedades} onChange={(e) => setRes({ ...res, enfermedades: e.target.value })} /></div>
              </div>
              <div className="cg2">
                <div className="fl"><label>Antecedentes odontológicos</label><textarea className="fi sm" rows={3} value={res.antecedentes} onChange={(e) => setRes({ ...res, antecedentes: e.target.value })} /></div>
                <div className="fl"><label>Observaciones generales</label><textarea className="fi sm" rows={3} value={res.observaciones} onChange={(e) => setRes({ ...res, observaciones: e.target.value })} /></div>
              </div>
              <div className="flex gap8" style={{ alignItems: "center" }}><button className="btn-sm" type="button" onClick={guardarResumen}>💾 Guardar resumen</button>{msgRes && <span className="txt-sm fw6" style={{ color: msgRes.t === "ok" ? "var(--green)" : "var(--rose)" }}>{msgRes.txt}</span>}</div>
            </div></div>
          )}

          {tab === "notas" && (
            <>
              <div style={{ marginBottom: 12 }}>{puedeEscribirNotas && <button className="btn-sm" onClick={() => setNotaModal({ nota: null })}>+ Nueva sesión clínica</button>}</div>
              {d.notas.length === 0 ? <div className="card"><div className="empty"><div className="ic">📝</div><div className="t">Sin notas clínicas</div><div className="s">Registra qué se hizo en cada sesión: motivo, diagnóstico, tratamiento e indicaciones.</div></div></div> : (
                <div className="tlv">{d.notas.map((n) => (
                  <div key={n.id} className="tlv-i" data-ic="📝">
                    <div className="tlv-t"><b>{n.motivo}</b><span className={"st " + (n.estado === "completada" ? "entregado" : "pendiente")}>{n.estado === "en_curso" ? "En curso" : n.estado === "completada" ? "Completada" : "Pendiente"}</span><span className="tlv-d">{fmtFecha(n.fecha, { day: "2-digit", month: "short", year: "numeric" })}</span></div>
                    <div className="tlv-b">{[n.diagnostico && "Diagnóstico: " + n.diagnostico, n.tratamiento && "Tratamiento: " + n.tratamiento, n.piezas && "Piezas: " + n.piezas, n.indicaciones && "Indicaciones: " + n.indicaciones, nombreDoc[n.doctor_id] && "Doctor: " + nombreDoc[n.doctor_id]].filter(Boolean).join("\n")}</div>
                    {puedeEscribirNotas && <button className="btn-sm sec" style={{ marginTop: 8 }} type="button" onClick={() => setNotaModal({ nota: n })}>Editar</button>}
                  </div>))}
                </div>
              )}
            </>
          )}

          {tab === "odonto" && (
            <>
              <div style={{ marginBottom: 12 }}><button className="btn-sm" onClick={() => irA && irA("odontograma")}>🦷 Abrir odontograma</button></div>
              {d.atenciones.length === 0 ? <div className="card"><div className="empty"><div className="ic">🦷</div><div className="t">Sin revisiones de odontograma</div><div className="s">Cada vez que guardes el odontograma de este paciente quedará una revisión con su fecha y hora.</div></div></div> : (
                <div className="tw"><table><thead><tr><th>Fecha</th><th>Hora</th><th>Doctor</th><th>Piezas registradas</th><th>Observaciones</th></tr></thead><tbody>
                  {d.atenciones.map((a) => <tr key={a.id}><td className="mono">{fmtFecha(a.fecha)}</td><td className="mono">{(a.hora || "").slice(0, 5) || "—"}</td><td>{nombreDoc[a.doctor_id] || "—"}</td><td className="mono">{d.piezasPorAtencion[a.id] || 0}</td><td>{a.observaciones_odontograma || "—"}</td></tr>)}
                </tbody></table></div>
              )}
            </>
          )}

          {tab === "trat" && (
            <>
              <div className="kpi-row">
                <div className="kpi t"><div className="kpi-ic">🧾</div><div className="kpi-v">{usd(fin.cargado)}</div><div className="kpi-l">Facturado</div></div>
                <div className="kpi g"><div className="kpi-ic">✅</div><div className="kpi-v">{usd(fin.pagado)}</div><div className="kpi-l">Pagado</div></div>
                <div className="kpi r"><div className="kpi-ic">⏳</div><div className="kpi-v">{usd(fin.saldo)}</div><div className="kpi-l">Saldo pendiente</div></div>
              </div>
              <div className="sec-t">Presupuestos</div>
              {d.presupuestos.length === 0 ? <div className="txt-muted" style={{ marginBottom: 16 }}>Sin presupuestos.</div> : d.presupuestos.map((p) => (
                <div key={p.id} className="card" style={{ marginBottom: 10 }}><div className="card-b">
                  <div className="flex gap8" style={{ alignItems: "center", flexWrap: "wrap" }}><b>{fmtFecha(p.fecha)}</b><span className={"tag " + (TAG_PRES[p.estado] || "ta")}>{p.estado}</span><span className="mono fw6" style={{ marginLeft: "auto" }}>{usd(totalPresupuesto(p))}</span></div>
                  <div className="txt-muted" style={{ marginTop: 6 }}>{(p.presupuesto_items || []).map((it) => it.nombre + (it.pieza ? ` (${it.pieza})` : "")).join(" · ") || "Sin ítems"}</div>
                </div></div>
              ))}
              <div className="sec-t" style={{ marginTop: 16 }}>Cargos y pagos</div>
              {d.cargos.length === 0 ? <div className="txt-muted">Sin cargos registrados.</div> : (
                <div className="tw"><table><thead><tr><th>Fecha</th><th>Concepto</th><th style={{ textAlign: "right" }}>Total</th><th style={{ textAlign: "right" }}>Pagado</th><th style={{ textAlign: "right" }}>Saldo</th></tr></thead><tbody>
                  {d.cargos.map((c) => { const pg = fin.pagadoPorCargo(c); const sd = Number(c.total || 0) - pg; return <tr key={c.id}><td className="mono">{fmtFecha(c.fecha)}</td><td>{c.procedimiento || "—"}</td><td className="mono" style={{ textAlign: "right" }}>{usd(c.total)}</td><td className="mono" style={{ textAlign: "right" }}>{usd(pg)}</td><td className="mono fw6" style={{ textAlign: "right", color: sd > 0.005 ? "var(--rose)" : "var(--green)" }}>{usd(sd)}</td></tr>; })}
                </tbody></table></div>
              )}
            </>
          )}

          {tab === "doctor" && (
            <div className="card"><div className="card-b">
              <div className="kv" style={{ marginBottom: 14 }}><span>Doctor asignado</span><div className="fw6">{nombreDoc[pac.doctor_id] || "Sin asignar"}</div></div>
              {esAdmin ? (
                <>
                  <div className="sec-t">Reasignar doctor</div>
                  <div className="cg2"><div className="fl"><label>Nuevo doctor</label><select className="fi sm" value={reasig.doctor} onChange={(e) => setReasig({ ...reasig, doctor: e.target.value })}><option value="">Seleccionar…</option>{doctores.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></div><div className="fl"><label>Motivo</label><input className="fi sm" value={reasig.motivo} onChange={(e) => setReasig({ ...reasig, motivo: e.target.value })} /></div></div>
                  <div className="flex gap8" style={{ alignItems: "center", marginBottom: 16 }}><button className="btn-sm" type="button" onClick={reasignar}>Reasignar</button>{msgDoc && <span className="txt-sm fw6" style={{ color: msgDoc.t === "ok" ? "var(--green)" : "var(--rose)" }}>{msgDoc.txt}</span>}</div>
                </>
              ) : <div className="txt-muted" style={{ marginBottom: 16 }}>Solo administración puede reasignar el doctor.</div>}
              <div className="sec-t">Historial de reasignaciones</div>
              {d.log.length === 0 ? <div className="txt-muted">Sin reasignaciones registradas.</div> : (
                <div className="tw"><table><thead><tr><th>Fecha</th><th>De</th><th>A</th><th>Motivo</th><th>Realizado por</th></tr></thead><tbody>
                  {d.log.map((l) => <tr key={l.id}><td className="mono">{fmtFecha(l.fecha)}</td><td>{nombreDoc[l.doctor_anterior_id] || "—"}</td><td>{nombreDoc[l.doctor_nuevo_id] || "—"}</td><td>{l.motivo || "—"}</td><td>{l.realizado_por || "—"}</td></tr>)}
                </tbody></table></div>
              )}
            </div></div>
          )}
        </>
      )}
      {notaModal && pac && <NotaModal nota={notaModal.nota} paciente={pac} doctores={doctores} citas={d.citas} consultorioId={consultorioId} userId={profile?.id} canDelete={esAdmin || rolUi === "recepcionista"} onClose={() => setNotaModal(null)} onSaved={() => { setNotaModal(null); cargarPaciente(pac.id); }} />}
    </div>
  );
}
