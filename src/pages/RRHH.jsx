import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { hoyISO, fmtFecha } from "../lib/format";
import "../styles/clinico.css";

const TIPOS_AUS = [
  { v: "vacaciones", label: "Vacaciones", icon: "🏖️" },
  { v: "enfermedad", label: "Enfermedad", icon: "🤒" },
  { v: "permiso", label: "Permiso", icon: "📝" },
  { v: "otro", label: "Otro", icon: "•" },
];
const TIPOS_ANT = [
  { v: "anticipo", label: "Anticipo", signo: -1 },
  { v: "prestamo", label: "Préstamo", signo: -1 },
  { v: "bono", label: "Bono", signo: 1 },
];
const ESTADOS_AUS = [{ v: "pendiente", label: "Pendiente" }, { v: "aprobada", label: "Aprobada" }, { v: "rechazada", label: "Rechazada" }];
const usd = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const iniciales = (n) => (n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join("");

function diasHabiles(desde, hasta) {
  if (!desde || !hasta || hasta < desde) return 0;
  const a = new Date(desde + "T00:00:00"), b = new Date(hasta + "T00:00:00");
  let n = 0;
  for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) { const w = d.getDay(); if (w !== 0 && w !== 6) n++; }
  return n;
}
function antiguedad(f) {
  if (!f) return "—";
  const a = new Date(f + "T00:00:00"), h = new Date();
  let m = (h.getFullYear() - a.getFullYear()) * 12 + h.getMonth() - a.getMonth();
  if (h.getDate() < a.getDate()) m--;
  if (m < 1) return "< 1 mes";
  const y = Math.floor(m / 12), r = m % 12;
  return [y ? `${y} a` : "", r ? `${r} m` : ""].filter(Boolean).join(" ");
}

const EMP_VACIO = { nombre: "", cargo: "", cedula: "", telefono: "", email: "", fecha_nac: "", direccion: "", fecha_ingreso: "", sueldo_base: "", comision_pct: "", banco: "", tipo_cuenta: "", numero_cuenta: "", activo: true };

function Modal({ titulo, sub, ancho = 540, onClose, children }) {
  return (
    <div className="appt-modal on" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="appt-box" style={{ width: ancho }}>
        <div className="appt-box-title">{titulo}</div>
        {sub && <div className="appt-box-sub">{sub}</div>}
        {children}
      </div>
    </div>
  );
}

function EmpleadoModal({ editing, consultorioId, onClose, onSaved }) {
  const [f, setF] = useState(() => (editing ? Object.fromEntries(Object.keys(EMP_VACIO).map((k) => [k, editing[k] ?? EMP_VACIO[k]])) : EMP_VACIO));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  async function guardar() {
    if (!f.nombre.trim()) return setError("Escribe el nombre.");
    if (!f.cargo.trim()) return setError("Indica el cargo.");
    const sb = f.sueldo_base === "" ? null : Number(f.sueldo_base);
    const cm = f.comision_pct === "" ? null : Number(f.comision_pct);
    if (sb !== null && (isNaN(sb) || sb < 0)) return setError("El sueldo base no es válido.");
    if (cm !== null && (isNaN(cm) || cm < 0 || cm > 100)) return setError("La comisión debe estar entre 0 y 100 %.");
    setSaving(true); setError("");
    const t = (v) => (String(v).trim() ? String(v).trim() : null);
    const payload = { nombre: f.nombre.trim(), cargo: f.cargo.trim(), cedula: t(f.cedula), telefono: t(f.telefono), email: t(f.email), fecha_nac: f.fecha_nac || null, direccion: t(f.direccion), fecha_ingreso: f.fecha_ingreso || null, sueldo_base: sb, comision_pct: cm, banco: t(f.banco), tipo_cuenta: t(f.tipo_cuenta), numero_cuenta: t(f.numero_cuenta), activo: f.activo };
    const res = editing ? await supabase.from("empleados").update(payload).eq("id", editing.id) : await supabase.from("empleados").insert({ ...payload, consultorio_id: consultorioId });
    setSaving(false);
    if (res.error) return setError(res.error.code === "23505" ? "Ya existe un empleado con esa cédula." : "No se pudo guardar: " + res.error.message);
    onSaved();
  }

  return (
    <Modal titulo={editing ? "✏️ Editar empleado" : "👔 Nuevo empleado"} sub="Datos laborales y de pago del equipo" ancho={580} onClose={onClose}>
      <div className="g2"><div className="fl"><label>Nombre completo *</label><input className="fi sm" value={f.nombre} onChange={(e) => set("nombre", e.target.value)} /></div><div className="fl"><label>Cargo *</label><input className="fi sm" placeholder="Asistente dental" value={f.cargo} onChange={(e) => set("cargo", e.target.value)} /></div></div>
      <div className="g3"><div className="fl"><label>Cédula</label><input className="fi sm mono" value={f.cedula} onChange={(e) => set("cedula", e.target.value)} /></div><div className="fl"><label>Teléfono</label><input className="fi sm" value={f.telefono} onChange={(e) => set("telefono", e.target.value)} /></div><div className="fl"><label>Email</label><input className="fi sm" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></div></div>
      <div className="g3"><div className="fl"><label>Fecha de nacimiento</label><input className="fi sm" type="date" value={f.fecha_nac} onChange={(e) => set("fecha_nac", e.target.value)} /></div><div className="fl"><label>Fecha de ingreso</label><input className="fi sm" type="date" value={f.fecha_ingreso} onChange={(e) => set("fecha_ingreso", e.target.value)} /></div><div className="fl"><label>Dirección</label><input className="fi sm" value={f.direccion} onChange={(e) => set("direccion", e.target.value)} /></div></div>
      <div className="sec-t">Remuneración</div>
      <div className="g2"><div className="fl"><label>Sueldo base mensual (USD)</label><input className="fi sm mono" type="number" min="0" step="0.01" value={f.sueldo_base} onChange={(e) => set("sueldo_base", e.target.value)} /></div><div className="fl"><label>Comisión (%)</label><input className="fi sm mono" type="number" min="0" max="100" step="0.5" value={f.comision_pct} onChange={(e) => set("comision_pct", e.target.value)} /></div></div>
      <div className="g3"><div className="fl"><label>Banco</label><input className="fi sm" value={f.banco} onChange={(e) => set("banco", e.target.value)} /></div><div className="fl"><label>Tipo de cuenta</label><select className="fi sm" value={f.tipo_cuenta} onChange={(e) => set("tipo_cuenta", e.target.value)}><option value="">—</option><option>Ahorros</option><option>Corriente</option></select></div><div className="fl"><label>N.º de cuenta</label><input className="fi sm mono" value={f.numero_cuenta} onChange={(e) => set("numero_cuenta", e.target.value)} /></div></div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 12 }}><input type="checkbox" checked={f.activo} onChange={(e) => set("activo", e.target.checked)} /> Empleado activo</label>
      {error && <div className="txt-sm" style={{ color: "var(--rose)", marginBottom: 10 }}>{error}</div>}
      <div className="flex gap8" style={{ justifyContent: "flex-end" }}><button className="btn-sm sec" type="button" onClick={onClose} disabled={saving}>Cancelar</button><button className="btn-sm" type="button" onClick={guardar} disabled={saving}>{saving ? "Guardando…" : "💾 Guardar"}</button></div>
    </Modal>
  );
}

function AusenciaModal({ empleados, ausencias, consultorioId, userId, onClose, onSaved }) {
  const [f, setF] = useState({ empleado_id: "", tipo: "vacaciones", desde: hoyISO(), hasta: hoyISO(), motivo: "", estado: "aprobada" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const dias = diasHabiles(f.desde, f.hasta);
  const choque = f.empleado_id && ausencias.some((a) => a.empleado_id === f.empleado_id && a.estado !== "rechazada" && a.desde <= f.hasta && a.hasta >= f.desde);

  async function guardar() {
    if (!f.empleado_id) return setError("Selecciona el empleado.");
    if (!f.desde || !f.hasta || f.hasta < f.desde) return setError("Revisa las fechas: «hasta» no puede ser anterior a «desde».");
    setSaving(true); setError("");
    const { error: err } = await supabase.from("ausencias").insert({ consultorio_id: consultorioId, empleado_id: f.empleado_id, tipo: f.tipo, desde: f.desde, hasta: f.hasta, dias, motivo: f.motivo.trim() || null, estado: f.estado, creado_por: userId });
    setSaving(false);
    if (err) return setError("No se pudo guardar: " + err.message);
    onSaved();
  }
  return (
    <Modal titulo="🏖️ Registrar ausencia" sub="Vacaciones, enfermedad o permisos del equipo" onClose={onClose}>
      <div className="g2"><div className="fl"><label>Empleado *</label><select className="fi sm" value={f.empleado_id} onChange={(e) => set("empleado_id", e.target.value)}><option value="">Seleccionar…</option>{empleados.filter((e) => e.activo).map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></div>
        <div className="fl"><label>Tipo</label><select className="fi sm" value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>{TIPOS_AUS.map((t) => <option key={t.v} value={t.v}>{t.icon} {t.label}</option>)}</select></div></div>
      <div className="g3"><div className="fl"><label>Desde</label><input className="fi sm" type="date" value={f.desde} onChange={(e) => set("desde", e.target.value)} /></div><div className="fl"><label>Hasta</label><input className="fi sm" type="date" value={f.hasta} onChange={(e) => set("hasta", e.target.value)} /></div><div className="fl"><label>Días hábiles</label><input className="fi sm mono" readOnly value={dias} /></div></div>
      {choque && <div className="warn-box"><span>⚠️</span><span>Este empleado ya tiene una ausencia que se cruza con esas fechas.</span></div>}
      <div className="g2"><div className="fl"><label>Estado</label><select className="fi sm" value={f.estado} onChange={(e) => set("estado", e.target.value)}>{ESTADOS_AUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}</select></div><div className="fl"><label>Motivo</label><input className="fi sm" value={f.motivo} onChange={(e) => set("motivo", e.target.value)} /></div></div>
      {error && <div className="txt-sm" style={{ color: "var(--rose)", marginBottom: 10 }}>{error}</div>}
      <div className="flex gap8" style={{ justifyContent: "flex-end" }}><button className="btn-sm sec" type="button" onClick={onClose} disabled={saving}>Cancelar</button><button className="btn-sm" type="button" onClick={guardar} disabled={saving}>{saving ? "Guardando…" : "💾 Registrar"}</button></div>
    </Modal>
  );
}

function AnticipoModal({ empleados, consultorioId, userId, onClose, onSaved }) {
  const [f, setF] = useState({ empleado_id: "", tipo: "anticipo", monto: "", fecha: hoyISO(), observaciones: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  async function guardar() {
    const monto = Number(f.monto);
    if (!f.empleado_id) return setError("Selecciona el empleado.");
    if (!(monto > 0)) return setError("El monto debe ser mayor a 0.");
    setSaving(true); setError("");
    const { error: err } = await supabase.from("anticipos").insert({ consultorio_id: consultorioId, empleado_id: f.empleado_id, tipo: f.tipo, monto, fecha: f.fecha, observaciones: f.observaciones.trim() || null, creado_por: userId });
    setSaving(false);
    if (err) return setError("No se pudo guardar: " + err.message);
    onSaved();
  }
  return (
    <Modal titulo="💵 Anticipo, préstamo o bono" sub="Al registrarlo, el sistema crea el gasto correspondiente en Contabilidad" onClose={onClose}>
      <div className="g2"><div className="fl"><label>Empleado *</label><select className="fi sm" value={f.empleado_id} onChange={(e) => set("empleado_id", e.target.value)}><option value="">Seleccionar…</option>{empleados.filter((e) => e.activo).map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></div>
        <div className="fl"><label>Tipo</label><select className="fi sm" value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>{TIPOS_ANT.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select></div></div>
      <div className="g2"><div className="fl"><label>Monto (USD) *</label><input className="fi sm mono" type="number" min="0" step="0.01" value={f.monto} onChange={(e) => set("monto", e.target.value)} /></div><div className="fl"><label>Fecha</label><input className="fi sm" type="date" value={f.fecha} onChange={(e) => set("fecha", e.target.value)} /></div></div>
      <div className="fl" style={{ marginBottom: 12 }}><label>Observaciones</label><input className="fi sm" value={f.observaciones} onChange={(e) => set("observaciones", e.target.value)} /></div>
      {error && <div className="txt-sm" style={{ color: "var(--rose)", marginBottom: 10 }}>{error}</div>}
      <div className="flex gap8" style={{ justifyContent: "flex-end" }}><button className="btn-sm sec" type="button" onClick={onClose} disabled={saving}>Cancelar</button><button className="btn-sm" type="button" onClick={guardar} disabled={saving}>{saving ? "Guardando…" : "💾 Registrar"}</button></div>
    </Modal>
  );
}

export default function RRHH() {
  const { profile, rolUi } = useAuth();
  const consultorioId = profile?.consultorio_id || null;
  const [emps, setEmps] = useState([]);
  const [aus, setAus] = useState([]);
  const [ants, setAnts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [tab, setTab] = useState("equipo");
  const [mes, setMes] = useState(hoyISO().slice(0, 7));
  const [verInactivos, setVerInactivos] = useState(false);
  const [filtroAus, setFiltroAus] = useState("all");
  const [modal, setModal] = useState(null); // {t:'emp'|'aus'|'ant', editing}
  const hoy = hoyISO();

  async function cargar() {
    if (!consultorioId) { setLoading(false); return; }
    const [e, a, n] = await Promise.all([
      supabase.from("empleados").select("*").eq("consultorio_id", consultorioId).order("nombre"),
      supabase.from("ausencias").select("*").eq("consultorio_id", consultorioId).order("desde", { ascending: false }).limit(300),
      supabase.from("anticipos").select("*").eq("consultorio_id", consultorioId).order("fecha", { ascending: false }).limit(500),
    ]);
    const err = e.error || a.error || n.error;
    if (err) setErrorCarga(err.message);
    setEmps(e.data || []); setAus(a.data || []); setAnts(n.data || []); setLoading(false);
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [consultorioId]);

  const nombre = useMemo(() => Object.fromEntries(emps.map((e) => [e.id, e.nombre])), [emps]);
  const activos = useMemo(() => emps.filter((e) => e.activo), [emps]);
  const ausentesHoy = useMemo(() => new Set(aus.filter((a) => a.estado === "aprobada" && a.desde <= hoy && a.hasta >= hoy).map((a) => a.empleado_id)), [aus, hoy]);
  const antsMes = useMemo(() => ants.filter((a) => (a.fecha || "").slice(0, 7) === mes), [ants, mes]);

  const rol = useMemo(() => activos.map((e) => {
    const mine = antsMes.filter((a) => a.empleado_id === e.id);
    const sum = (t) => mine.filter((a) => a.tipo === t).reduce((s, a) => s + Number(a.monto), 0);
    const base = Number(e.sueldo_base || 0), bonos = sum("bono"), anticipos = sum("anticipo"), prestamos = sum("prestamo");
    return { e, base, bonos, anticipos, prestamos, neto: base + bonos - anticipos - prestamos };
  }), [activos, antsMes]);
  const totales = useMemo(() => rol.reduce((t, r) => ({ base: t.base + r.base, bonos: t.bonos + r.bonos, desc: t.desc + r.anticipos + r.prestamos, neto: t.neto + r.neto }), { base: 0, bonos: 0, desc: 0, neto: 0 }), [rol]);

  async function resolver(a, estado) {
    const { error } = await supabase.from("ausencias").update({ estado }).eq("id", a.id);
    if (error) return window.alert("No se pudo actualizar: " + error.message);
    setAus((arr) => arr.map((x) => (x.id === a.id ? { ...x, estado } : x)));
  }
  async function borrar(tabla, id, texto) {
    if (!window.confirm(texto)) return;
    const { error } = await supabase.from(tabla).delete().eq("id", id);
    if (error) return window.alert("No se pudo eliminar: " + error.message);
    cargar();
  }
  function exportarCsv() {
    const filas = [["Empleado", "Cargo", "Sueldo base", "Bonos", "Anticipos", "Préstamos", "Neto estimado"], ...rol.map((r) => [r.e.nombre, r.e.cargo, r.base.toFixed(2), r.bonos.toFixed(2), r.anticipos.toFixed(2), r.prestamos.toFixed(2), r.neto.toFixed(2)])];
    const csv = "\uFEFF" + filas.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `rol-estimado-${mes}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  const cerrar = () => setModal(null);
  const guardado = () => { cerrar(); cargar(); };

  if (!consultorioId) return <div className="mod"><div className="card"><div className="empty"><div className="ic">🏥</div><div className="t">Sin clínica asociada</div></div></div></div>;
  if (rolUi !== "admin") return <div className="mod"><div className="card"><div className="empty"><div className="ic">🔒</div><div className="t">Solo administración</div><div className="s">Este módulo contiene información salarial del equipo.</div></div></div></div>;

  const empsVisibles = emps.filter((e) => verInactivos || e.activo);
  const ausVisibles = aus.filter((a) => filtroAus === "all" || a.estado === filtroAus);

  return (
    <div className="mod">
      <div className="mh">
        <div><div className="mh-t">👔 RRHH y nómina</div><div className="mh-s">Equipo, ausencias, anticipos y estimación del rol de pagos</div></div>
        <div className="mh-a">
          <div className="cal-view-toggle" role="tablist">
            {[["equipo", "👥 Equipo"], ["ausencias", "🏖️ Ausencias"], ["anticipos", "💵 Anticipos"], ["rol", "🧾 Rol del mes"]].map(([v, l]) => <button key={v} type="button" className={"cvt-btn" + (tab === v ? " on" : "")} onClick={() => setTab(v)}>{l}</button>)}
          </div>
          {tab === "equipo" && <button className="btn-sm" onClick={() => setModal({ t: "emp", editing: null })}>+ Empleado</button>}
          {tab === "ausencias" && <button className="btn-sm" onClick={() => setModal({ t: "aus" })}>+ Ausencia</button>}
          {tab === "anticipos" && <button className="btn-sm" onClick={() => setModal({ t: "ant" })}>+ Registrar</button>}
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi t"><div className="kpi-ic">👥</div><div className="kpi-v">{activos.length}</div><div className="kpi-l">Empleados activos</div></div>
        <div className="kpi g"><div className="kpi-ic">💰</div><div className="kpi-v">{usd(activos.reduce((s, e) => s + Number(e.sueldo_base || 0), 0))}</div><div className="kpi-l">Nómina base mensual</div></div>
        <div className="kpi b"><div className="kpi-ic">⏳</div><div className="kpi-v">{aus.filter((a) => a.estado === "pendiente").length}</div><div className="kpi-l">Ausencias por aprobar</div></div>
        <div className="kpi r"><div className="kpi-ic">💵</div><div className="kpi-v">{usd(antsMes.filter((a) => a.tipo !== "bono").reduce((s, a) => s + Number(a.monto), 0))}</div><div className="kpi-l">Anticipos y préstamos del mes</div></div>
      </div>

      {errorCarga && <div className="card mb14"><div className="card-b txt-sm" style={{ color: "var(--rose)" }}>No se pudieron cargar los datos: {errorCarga}</div></div>}
      {loading ? <div className="sk" style={{ height: 260 }} /> : tab === "equipo" ? (
        <>
          <label className="txt-sm" style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 12 }}><input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} /> Mostrar inactivos</label>
          {empsVisibles.length === 0 ? (
            <div className="card"><div className="empty"><div className="ic">👔</div><div className="t">Aún no registras empleados</div><div className="s">Agrega a tu equipo para llevar ausencias, anticipos y el rol de pagos estimado.</div><button className="btn-sm" onClick={() => setModal({ t: "emp", editing: null })}>+ Agregar empleado</button></div></div>
          ) : (
            <div className="emp-grid">
              {empsVisibles.map((e) => (
                <div key={e.id} className={"emp" + (e.activo ? "" : " off")}>
                  <div className="emp-h">
                    <div className="av">{iniciales(e.nombre)}</div>
                    <div style={{ minWidth: 0 }}><div className="emp-n">{e.nombre}</div><div className="emp-c">{e.cargo}{!e.activo ? " · inactivo" : ""}</div></div>
                    {ausentesHoy.has(e.id) && <span className="due warn" style={{ marginLeft: "auto" }}>Ausente hoy</span>}
                  </div>
                  <div className="emp-k">
                    <div><span>Sueldo base</span><b>{e.sueldo_base != null ? usd(e.sueldo_base) : "—"}</b></div>
                    <div><span>Comisión</span><b>{e.comision_pct != null ? e.comision_pct + " %" : "—"}</b></div>
                    <div><span>Antigüedad</span><b>{antiguedad(e.fecha_ingreso)}</b></div>
                    <div><span>Ingreso</span><b>{fmtFecha(e.fecha_ingreso, { day: "2-digit", month: "short", year: "2-digit" })}</b></div>
                  </div>
                  <div className="txt-muted">{[e.telefono && "📞 " + e.telefono, e.email && "✉️ " + e.email].filter(Boolean).join("  ·  ") || "Sin datos de contacto"}</div>
                  <button className="btn-sm sec" type="button" onClick={() => setModal({ t: "emp", editing: e })}>Editar</button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : tab === "ausencias" ? (
        <>
          <div className="chips" style={{ marginBottom: 12 }}>
            <button type="button" className={"chip" + (filtroAus === "all" ? " on" : "")} onClick={() => setFiltroAus("all")}>Todas<span className="n">{aus.length}</span></button>
            {ESTADOS_AUS.map((s) => <button key={s.v} type="button" className={"chip" + (filtroAus === s.v ? " on" : "")} onClick={() => setFiltroAus(s.v)}>{s.label}<span className="n">{aus.filter((a) => a.estado === s.v).length}</span></button>)}
          </div>
          <div className="tw"><table>
            <thead><tr><th>Empleado</th><th>Tipo</th><th>Periodo</th><th>Días</th><th>Motivo</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {ausVisibles.length === 0 && <tr><td colSpan={7} className="txt-muted" style={{ padding: 20 }}>No hay ausencias para mostrar.</td></tr>}
              {ausVisibles.map((a) => (
                <tr key={a.id}>
                  <td><strong>{nombre[a.empleado_id] || "—"}</strong></td>
                  <td>{TIPOS_AUS.find((t) => t.v === a.tipo)?.icon} {TIPOS_AUS.find((t) => t.v === a.tipo)?.label || a.tipo}</td>
                  <td className="mono">{fmtFecha(a.desde, { day: "2-digit", month: "short" })} → {fmtFecha(a.hasta, { day: "2-digit", month: "short", year: "numeric" })}</td>
                  <td className="mono">{a.dias ?? "—"}</td>
                  <td style={{ maxWidth: 220 }}>{a.motivo || "—"}</td>
                  <td><span className={"st " + (a.estado === "aprobada" ? "entregado" : a.estado === "rechazada" ? "fallido" : "pendiente")}>{ESTADOS_AUS.find((s) => s.v === a.estado)?.label}</span></td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {a.estado === "pendiente" && <><button className="btn-sm" type="button" onClick={() => resolver(a, "aprobada")}>✓ Aprobar</button> <button className="btn-sm sec" type="button" onClick={() => resolver(a, "rechazada")}>Rechazar</button> </>}
                    <button className="btn-sm sec" type="button" title="Eliminar" onClick={() => borrar("ausencias", a.id, "¿Eliminar esta ausencia?")}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </>
      ) : tab === "anticipos" ? (
        <div className="tw"><table>
          <thead><tr><th>Fecha</th><th>Empleado</th><th>Tipo</th><th style={{ textAlign: "right" }}>Monto</th><th>Observaciones</th><th /></tr></thead>
          <tbody>
            {ants.length === 0 && <tr><td colSpan={6} className="txt-muted" style={{ padding: 20 }}>Aún no hay anticipos, préstamos ni bonos registrados.</td></tr>}
            {ants.map((a) => (
              <tr key={a.id}>
                <td className="mono">{fmtFecha(a.fecha, { day: "2-digit", month: "short", year: "numeric" })}</td>
                <td><strong>{nombre[a.empleado_id] || "—"}</strong></td>
                <td><span className={"st " + (a.tipo === "bono" ? "entregado" : "pendiente")}>{TIPOS_ANT.find((t) => t.v === a.tipo)?.label || a.tipo}</span></td>
                <td className="mono" style={{ textAlign: "right", fontWeight: 700 }}>{usd(a.monto)}</td>
                <td>{a.observaciones || "—"}</td>
                <td><button className="btn-sm sec" type="button" title="Eliminar" onClick={() => borrar("anticipos", a.id, "¿Eliminar este registro? Revisa también el gasto asociado en Contabilidad.")}>🗑</button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      ) : (
        <div className="card">
          <div className="card-b">
            <div className="flex gap8" style={{ alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
              <label className="fw6">Mes</label><input className="fi sm" style={{ width: "auto" }} type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
              <button className="btn-sm sec" style={{ marginLeft: "auto" }} onClick={exportarCsv} disabled={rol.length === 0}>⬇ Exportar CSV</button>
            </div>
            {rol.length === 0 ? <div className="empty"><div className="s">No hay empleados activos.</div></div> : (
              <div className="tw" style={{ marginBottom: 12 }}><table>
                <thead><tr><th>Empleado</th><th style={{ textAlign: "right" }}>Sueldo base</th><th style={{ textAlign: "right" }}>+ Bonos</th><th style={{ textAlign: "right" }}>− Anticipos</th><th style={{ textAlign: "right" }}>− Préstamos</th><th style={{ textAlign: "right" }}>Neto estimado</th></tr></thead>
                <tbody>
                  {rol.map((r) => (
                    <tr key={r.e.id}>
                      <td><strong>{r.e.nombre}</strong><div className="txt-muted">{r.e.cargo}</div></td>
                      <td className="mono" style={{ textAlign: "right" }}>{usd(r.base)}</td>
                      <td className="mono" style={{ textAlign: "right", color: r.bonos ? "var(--green)" : undefined }}>{usd(r.bonos)}</td>
                      <td className="mono" style={{ textAlign: "right", color: r.anticipos ? "var(--rose)" : undefined }}>{usd(r.anticipos)}</td>
                      <td className="mono" style={{ textAlign: "right", color: r.prestamos ? "var(--rose)" : undefined }}>{usd(r.prestamos)}</td>
                      <td className="mono" style={{ textAlign: "right", fontWeight: 700 }}>{usd(r.neto)}</td>
                    </tr>
                  ))}
                  <tr><td><strong>Total</strong></td><td className="mono" style={{ textAlign: "right", fontWeight: 700 }}>{usd(totales.base)}</td><td className="mono" style={{ textAlign: "right", fontWeight: 700 }}>{usd(totales.bonos)}</td><td colSpan={2} className="mono" style={{ textAlign: "right", fontWeight: 700 }}>− {usd(totales.desc)}</td><td className="mono" style={{ textAlign: "right", fontWeight: 700 }}>{usd(totales.neto)}</td></tr>
                </tbody>
              </table></div>
            )}
            <div className="txt-muted" style={{ lineHeight: 1.5 }}>Estimación informativa: suma bonos y descuenta anticipos y préstamos del mes. No incluye aportes de ley, décimos, horas extra ni comisiones.</div>
          </div>
        </div>
      )}

      {modal?.t === "emp" && <EmpleadoModal editing={modal.editing} consultorioId={consultorioId} onClose={cerrar} onSaved={guardado} />}
      {modal?.t === "aus" && <AusenciaModal empleados={emps} ausencias={aus} consultorioId={consultorioId} userId={profile?.id} onClose={cerrar} onSaved={guardado} />}
      {modal?.t === "ant" && <AnticipoModal empleados={emps} consultorioId={consultorioId} userId={profile?.id} onClose={cerrar} onSaved={guardado} />}
    </div>
  );
}
