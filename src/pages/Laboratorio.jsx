import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { hoyISO, diasEntre, fmtFecha } from "../lib/format";
import "../styles/clinico.css";

const ESTADOS = [
  { v: "proceso", label: "En proceso", icon: "⏳", color: "var(--amber)" },
  { v: "prueba", label: "En prueba", icon: "🔄", color: "var(--teal)" },
  { v: "listo", label: "Listo para entrega", icon: "✅", color: "var(--green)" },
  { v: "entregado", label: "Entregado", icon: "📦", color: "var(--muted)" },
];
const ADV_LABEL = { prueba: "→ A prueba", listo: "✓ Marcar listo", entregado: "📦 Entregar" };
const IDX = Object.fromEntries(ESTADOS.map((e, i) => [e.v, i]));

function dueInfo(t, hoy) {
  if (t.estado === "entregado") return { cls: "none", txt: "Entregado" };
  if (!t.fecha_entrega) return { cls: "none", txt: "Sin fecha de entrega" };
  const d = diasEntre(hoy, t.fecha_entrega);
  if (d < 0) return { cls: "late", txt: `Atrasado ${Math.abs(d)} d` };
  if (d === 0) return { cls: "warn", txt: "Entrega hoy" };
  if (d <= 2) return { cls: "warn", txt: `En ${d} d` };
  return { cls: "ok", txt: `En ${d} d` };
}

const EMPTY = { paciente_id: "", doctor_id: "", descripcion: "", laboratorio: "", fecha_envio: hoyISO(), fecha_entrega: "", estado: "proceso", observaciones: "" };

function TrabajoModal({ open, editing, pacientes, doctores, consultorioId, userId, canDelete, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(
      editing
        ? {
            paciente_id: editing.paciente_id || "",
            doctor_id: editing.doctor_id || "",
            descripcion: editing.descripcion || "",
            laboratorio: editing.laboratorio || "",
            fecha_envio: editing.fecha_envio || "",
            fecha_entrega: editing.fecha_entrega || "",
            estado: editing.estado || "proceso",
            observaciones: editing.observaciones || "",
          }
        : { ...EMPTY, fecha_envio: hoyISO() }
    );
    setError("");
  }, [open, editing]);

  if (!open) return null;
  const set = (f, v) => setForm((s) => ({ ...s, [f]: v }));

  async function guardar() {
    if (!form.paciente_id) return setError("Selecciona el paciente.");
    if (!form.descripcion.trim()) return setError("Describe el trabajo (ej. Corona metal-porcelana pieza 21).");
    if (form.fecha_envio && form.fecha_entrega && form.fecha_entrega < form.fecha_envio)
      return setError("La fecha de entrega no puede ser anterior a la de envío.");
    setSaving(true);
    setError("");
    const payload = {
      paciente_id: form.paciente_id,
      doctor_id: form.doctor_id || null,
      descripcion: form.descripcion.trim(),
      laboratorio: form.laboratorio.trim() || null,
      fecha_envio: form.fecha_envio || null,
      fecha_entrega: form.fecha_entrega || null,
      estado: form.estado,
      observaciones: form.observaciones.trim() || null,
    };
    let res;
    if (editing) res = await supabase.from("trabajos_laboratorio").update(payload).eq("id", editing.id);
    else res = await supabase.from("trabajos_laboratorio").insert({ ...payload, consultorio_id: consultorioId, creado_por: userId });
    setSaving(false);
    if (res.error) return setError("No se pudo guardar: " + res.error.message);
    onSaved();
  }

  async function eliminar() {
    if (!window.confirm("¿Eliminar este trabajo de laboratorio? Esta acción no se puede deshacer.")) return;
    setSaving(true);
    const { error: err } = await supabase.from("trabajos_laboratorio").delete().eq("id", editing.id);
    setSaving(false);
    if (err) return setError("No se pudo eliminar: " + err.message);
    onSaved();
  }

  return (
    <div className="appt-modal on" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="appt-box" style={{ width: 540 }}>
        <div className="appt-box-title">{editing ? "✏️ Editar trabajo" : "🔬 Nuevo trabajo de laboratorio"}</div>
        <div className="appt-box-sub">Registra lo enviado al laboratorio y su fecha de entrega</div>

        <div className="g2">
          <div className="fl">
            <label>Paciente *</label>
            <select className="fi sm" value={form.paciente_id} onChange={(e) => set("paciente_id", e.target.value)}>
              <option value="">Seleccionar…</option>
              {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="fl">
            <label>Doctor</label>
            <select className="fi sm" value={form.doctor_id} onChange={(e) => set("doctor_id", e.target.value)}>
              <option value="">Sin asignar</option>
              {doctores.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          </div>
        </div>

        <div className="fl" style={{ marginBottom: 12 }}>
          <label>Trabajo *</label>
          <input className="fi sm" placeholder="Ej. Corona metal-porcelana pieza 21, color A2" value={form.descripcion} onChange={(e) => set("descripcion", e.target.value)} />
        </div>

        <div className="g2">
          <div className="fl"><label>Laboratorio</label><input className="fi sm" placeholder="Nombre del laboratorio" value={form.laboratorio} onChange={(e) => set("laboratorio", e.target.value)} /></div>
          <div className="fl">
            <label>Estado</label>
            <select className="fi sm" value={form.estado} onChange={(e) => set("estado", e.target.value)}>
              {ESTADOS.map((e) => <option key={e.v} value={e.v}>{e.icon} {e.label}</option>)}
            </select>
          </div>
        </div>

        <div className="g2">
          <div className="fl"><label>Fecha de envío</label><input className="fi sm" type="date" value={form.fecha_envio} onChange={(e) => set("fecha_envio", e.target.value)} /></div>
          <div className="fl"><label>Fecha de entrega</label><input className="fi sm" type="date" value={form.fecha_entrega} onChange={(e) => set("fecha_entrega", e.target.value)} /></div>
        </div>

        <div className="fl" style={{ marginBottom: 12 }}>
          <label>Observaciones</label>
          <textarea className="fi sm" rows={3} placeholder="Color, ajustes, pruebas requeridas…" value={form.observaciones} onChange={(e) => set("observaciones", e.target.value)} />
        </div>

        {error && <div className="txt-sm" style={{ color: "var(--rose)", marginBottom: 10 }}>{error}</div>}

        <div className="flex gap8 items-c" style={{ justifyContent: "space-between" }}>
          <div>{editing && canDelete && <button className="btn-sm danger" type="button" onClick={eliminar} disabled={saving}>🗑 Eliminar</button>}</div>
          <div className="flex gap8">
            <button className="btn-sm sec" type="button" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="btn-sm" type="button" onClick={guardar} disabled={saving}>{saving ? "Guardando…" : "💾 Guardar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Laboratorio() {
  const { profile, rolUi } = useAuth();
  const consultorioId = profile?.consultorio_id || null;
  const canDelete = rolUi === "admin" || rolUi === "recepcionista";

  const [trabajos, setTrabajos] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [doctores, setDoctores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [vista, setVista] = useState("tablero");
  const [filtroDoctor, setFiltroDoctor] = useState("all");
  const [q, setQ] = useState("");
  const [modal, setModal] = useState({ open: false, editing: null });
  const [arrastrando, setArrastrando] = useState(null);
  const [colOver, setColOver] = useState(null);
  const hoy = hoyISO();

  async function cargar() {
    if (!consultorioId) { setLoading(false); return; }
    setLoading(true);
    setErrorCarga("");
    const [t, p, d] = await Promise.all([
      supabase.from("trabajos_laboratorio").select("*").eq("consultorio_id", consultorioId).order("fecha_entrega", { ascending: true, nullsFirst: false }),
      supabase.from("pacientes").select("id,nombre").eq("consultorio_id", consultorioId).eq("activo", true).order("nombre"),
      supabase.from("doctores").select("id,nombre").eq("consultorio_id", consultorioId).order("nombre"),
    ]);
    if (t.error) setErrorCarga(t.error.message);
    setTrabajos(t.data || []);
    setPacientes(p.data || []);
    setDoctores(d.data || []);
    setLoading(false);
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [consultorioId]);

  const nombrePac = useMemo(() => Object.fromEntries(pacientes.map((p) => [p.id, p.nombre])), [pacientes]);
  const nombreDoc = useMemo(() => Object.fromEntries(doctores.map((d) => [d.id, d.nombre])), [doctores]);

  const visibles = useMemo(() => {
    const term = q.trim().toLowerCase();
    return trabajos.filter((t) => {
      if (filtroDoctor !== "all" && t.doctor_id !== filtroDoctor) return false;
      if (!term) return true;
      return [nombrePac[t.paciente_id], t.descripcion, t.laboratorio].some((s) => (s || "").toLowerCase().includes(term));
    });
  }, [trabajos, filtroDoctor, q, nombrePac]);

  const kpis = useMemo(() => {
    const activos = trabajos.filter((t) => t.estado !== "entregado");
    const mes = hoy.slice(0, 7);
    return {
      activos: activos.length,
      listos: trabajos.filter((t) => t.estado === "listo").length,
      atrasados: activos.filter((t) => t.fecha_entrega && t.fecha_entrega < hoy).length,
      entregadosMes: trabajos.filter((t) => t.estado === "entregado" && (t.updated_at || "").slice(0, 7) === mes).length,
    };
  }, [trabajos, hoy]);

  async function mover(id, estado) {
    const actual = trabajos.find((t) => t.id === id);
    if (!actual || actual.estado === estado) return;
    setTrabajos((arr) => arr.map((t) => (t.id === id ? { ...t, estado } : t))); // optimista
    const { error } = await supabase.from("trabajos_laboratorio").update({ estado }).eq("id", id);
    if (error) { window.alert("No se pudo cambiar el estado: " + error.message); cargar(); }
  }

  const abrirNuevo = () => setModal({ open: true, editing: null });
  const abrirEditar = (t) => setModal({ open: true, editing: t });
  const cerrar = () => setModal({ open: false, editing: null });
  async function alGuardar() { cerrar(); await cargar(); }

  if (!consultorioId) {
    return <div className="mod"><div className="card"><div className="empty"><div className="ic">🏥</div><div className="t">Sin clínica asociada</div><div className="s">Tu usuario no está vinculado a un consultorio.</div></div></div></div>;
  }

  return (
    <div className="mod">
      <div className="mh">
        <div>
          <div className="mh-t">🔬 Laboratorio y trabajos</div>
          <div className="mh-s">Coronas, prótesis e implantes: seguimiento desde el envío hasta la entrega al paciente</div>
        </div>
        <div className="mh-a">
          <div className="cal-view-toggle" role="tablist">
            <button type="button" className={"cvt-btn" + (vista === "tablero" ? " on" : "")} onClick={() => setVista("tablero")}>▦ Tablero</button>
            <button type="button" className={"cvt-btn" + (vista === "lista" ? " on" : "")} onClick={() => setVista("lista")}>☰ Lista</button>
          </div>
          <button className="btn-sm" onClick={abrirNuevo}>+ Nuevo trabajo</button>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi t"><div className="kpi-ic">🔬</div><div className="kpi-v">{kpis.activos}</div><div className="kpi-l">Trabajos activos</div></div>
        <div className="kpi g"><div className="kpi-ic">✅</div><div className="kpi-v">{kpis.listos}</div><div className="kpi-l">Listos para entrega</div></div>
        <div className="kpi r"><div className="kpi-ic">⏰</div><div className="kpi-v">{kpis.atrasados}</div><div className="kpi-l">Atrasados</div></div>
        <div className="kpi b"><div className="kpi-ic">📦</div><div className="kpi-v">{kpis.entregadosMes}</div><div className="kpi-l">Entregados este mes</div></div>
      </div>

      <div className="toolbar">
        <div className="search"><input className="fi sm" placeholder="Buscar paciente, trabajo o laboratorio…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="fi sm" style={{ width: "auto" }} value={filtroDoctor} onChange={(e) => setFiltroDoctor(e.target.value)}>
          <option value="all">Todos los doctores</option>
          {doctores.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
      </div>

      {errorCarga && <div className="card mb14"><div className="card-b txt-sm" style={{ color: "var(--rose)" }}>No se pudieron cargar los trabajos: {errorCarga}</div></div>}

      {loading ? (
        <div className="kb">{ESTADOS.map((e) => <div key={e.v} className="sk" style={{ height: 300 }} />)}</div>
      ) : trabajos.length === 0 ? (
        <div className="card"><div className="empty"><div className="ic">🔬</div><div className="t">Aún no hay trabajos de laboratorio</div><div className="s">Registra una corona, prótesis o carilla enviada al laboratorio y sigue su avance hasta entregarla al paciente.</div><button className="btn-sm" onClick={abrirNuevo}>+ Registrar primer trabajo</button></div></div>
      ) : vista === "tablero" ? (
        <div className="kb">
          {ESTADOS.map((col) => {
            const items = visibles.filter((t) => t.estado === col.v);
            const mostrados = col.v === "entregado" ? items.slice(0, 20) : items;
            return (
              <div
                key={col.v}
                className={"kb-col" + (colOver === col.v ? " over" : "")}
                style={{ "--c": col.color }}
                onDragOver={(e) => { e.preventDefault(); setColOver(col.v); }}
                onDragLeave={() => setColOver((c) => (c === col.v ? null : c))}
                onDrop={(e) => { e.preventDefault(); setColOver(null); if (arrastrando) mover(arrastrando, col.v); setArrastrando(null); }}
              >
                <div className="kb-h"><span className="dot" />{col.icon} {col.label}<span className="cnt">{items.length}</span></div>
                <div className="kb-b">
                  {mostrados.length === 0 && <div className="txt-muted" style={{ textAlign: "center", padding: "18px 6px" }}>Arrastra un trabajo aquí</div>}
                  {mostrados.map((t) => {
                    const due = dueInfo(t, hoy);
                    const sig = ESTADOS[IDX[t.estado] + 1];
                    return (
                      <div
                        key={t.id}
                        className={"kb-card" + (arrastrando === t.id ? " drag" : "")}
                        style={{ "--c": col.color }}
                        draggable
                        onDragStart={(e) => { setArrastrando(t.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", t.id); }}
                        onDragEnd={() => { setArrastrando(null); setColOver(null); }}
                        onDoubleClick={() => abrirEditar(t)}
                      >
                        <div className="p">{nombrePac[t.paciente_id] || "Paciente"}</div>
                        <div className="d">{t.descripcion}</div>
                        <div className="m">
                          {t.laboratorio && <span>🏭 {t.laboratorio}</span>}
                          {t.doctor_id && nombreDoc[t.doctor_id] && <span>🩺 {nombreDoc[t.doctor_id]}</span>}
                        </div>
                        <div className="f">
                          <span className={"due " + due.cls}>{due.txt}</span>
                          <span style={{ display: "flex", gap: 4 }}>
                            <button type="button" className="kb-edit" onClick={() => abrirEditar(t)} title="Editar">✏️</button>
                            {sig && <button type="button" className="kb-adv" onClick={() => mover(t.id, sig.v)}>{ADV_LABEL[sig.v]}</button>}
                          </span>
                        </div>
                        <div className="stp">{ESTADOS.map((e, i) => <i key={e.v} className={i <= IDX[t.estado] ? "on" : ""} />)}</div>
                      </div>
                    );
                  })}
                  {col.v === "entregado" && items.length > 20 && <div className="txt-muted" style={{ textAlign: "center" }}>+{items.length - 20} más — usa la vista Lista</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="tw">
          <table>
            <thead><tr><th>Paciente</th><th>Trabajo</th><th>Laboratorio</th><th>Doctor</th><th>Envío</th><th>Entrega</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {visibles.length === 0 && <tr><td colSpan={8} className="txt-muted" style={{ padding: 20 }}>Ningún trabajo coincide con el filtro.</td></tr>}
              {visibles.map((t) => {
                const due = dueInfo(t, hoy);
                return (
                  <tr key={t.id}>
                    <td><strong>{nombrePac[t.paciente_id] || "—"}</strong></td>
                    <td style={{ maxWidth: 260 }}>{t.descripcion}</td>
                    <td>{t.laboratorio || "—"}</td>
                    <td>{nombreDoc[t.doctor_id] || "—"}</td>
                    <td className="mono">{fmtFecha(t.fecha_envio, { day: "2-digit", month: "short" })}</td>
                    <td><div className="mono" style={{ marginBottom: 3 }}>{fmtFecha(t.fecha_entrega, { day: "2-digit", month: "short" })}</div><span className={"due " + due.cls}>{due.txt}</span></td>
                    <td>
                      <select className="fi sm" style={{ width: "auto" }} value={t.estado} onChange={(e) => mover(t.id, e.target.value)}>
                        {ESTADOS.map((e) => <option key={e.v} value={e.v}>{e.icon} {e.label}</option>)}
                      </select>
                    </td>
                    <td><button className="btn-sm sec" type="button" onClick={() => abrirEditar(t)}>Editar</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <TrabajoModal open={modal.open} editing={modal.editing} pacientes={pacientes} doctores={doctores} consultorioId={consultorioId} userId={profile?.id} canDelete={canDelete} onClose={cerrar} onSaved={alGuardar} />
    </div>
  );
}
