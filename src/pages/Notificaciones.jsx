import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { fmtHora, fmtFecha, soloDigitos } from "../lib/format";
import "../styles/clinico.css";

const CANALES = [
  { v: "whatsapp", label: "WhatsApp", icon: "📱" },
  { v: "email", label: "Email", icon: "✉️" },
  { v: "interna", label: "Interna", icon: "🔔" },
];
const ICONO = Object.fromEntries(CANALES.map((c) => [c.v, c.icon]));
const ESTADOS = [
  { v: "pendiente", label: "Pendiente" },
  { v: "enviado", label: "Enviado" },
  { v: "entregado", label: "Entregado" },
  { v: "fallido", label: "Fallido" },
];
const PLANTILLAS = [
  { id: "recordatorio", label: "📅 Recordatorio", txt: "Hola {paciente} 👋, te recordamos tu cita en {clinica}. Responde a este mensaje para confirmar o reagendar. 🦷" },
  { id: "confirmacion", label: "✅ Confirmación", txt: "Hola {paciente}, tu cita en {clinica} quedó confirmada. ¡Te esperamos!" },
  { id: "bienvenida", label: "👋 Bienvenida", txt: "¡Bienvenido/a a {clinica}, {paciente}! Estamos para cuidar tu sonrisa. Escríbenos si necesitas agendar una cita." },
  { id: "seguimiento", label: "🔁 Seguimiento", txt: "Hola {paciente}, ¿cómo te sientes después de tu tratamiento? Si tienes molestias, responde este mensaje y te ayudamos. — {clinica}" },
];

function etiquetaDia(iso) {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
  const mismo = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (mismo(d, hoy)) return "Hoy";
  if (mismo(d, ayer)) return "Ayer";
  return d.toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" });
}
function claveDia(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function ComponerModal({ open, pacientes, clinica, consultorioId, userId, onClose, onSaved }) {
  const [canal, setCanal] = useState("whatsapp");
  const [pacienteId, setPacienteId] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [programar, setProgramar] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (open) { setCanal("whatsapp"); setPacienteId(""); setMensaje(""); setProgramar(""); setError(""); } }, [open]);
  if (!open) return null;

  const pac = pacientes.find((p) => p.id === pacienteId);
  const destinatario = !pac ? "" : canal === "whatsapp" ? pac.telefono || "" : canal === "email" ? pac.email || "" : pac.nombre;

  function aplicar(t) { setMensaje(t.txt.replaceAll("{paciente}", pac?.nombre?.split(" ")[0] || "{paciente}").replaceAll("{clinica}", clinica || "la clínica")); }

  async function guardar() {
    if (!pac) return setError("Selecciona el paciente.");
    if (!destinatario) return setError(canal === "whatsapp" ? "Este paciente no tiene teléfono registrado." : "Este paciente no tiene correo registrado.");
    if (!mensaje.trim()) return setError("Escribe el mensaje.");
    setSaving(true);
    const { error: err } = await supabase.from("notificaciones").insert({
      consultorio_id: consultorioId, paciente_id: pac.id, canal, destinatario, mensaje: mensaje.trim(), estado: "pendiente",
      fecha_envio: programar ? new Date(programar).toISOString() : null, creado_por: userId,
    });
    setSaving(false);
    if (err) return setError("No se pudo encolar: " + err.message);
    onSaved();
  }

  return (
    <div className="appt-modal on" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="appt-box" style={{ width: 540 }}>
        <div className="appt-box-title">📣 Nuevo mensaje</div>
        <div className="appt-box-sub">Queda en la cola de envío con estado «Pendiente»</div>

        <div className="fl"><label>Canal</label>
          <div className="chips">{CANALES.map((c) => <button key={c.v} type="button" className={"chip" + (canal === c.v ? " on" : "")} onClick={() => setCanal(c.v)}>{c.icon} {c.label}</button>)}</div>
        </div>
        <div className="fl"><label>Paciente *</label>
          <select className="fi sm" value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}>
            <option value="">Seleccionar…</option>
            {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          {pac && <div className="txt-muted" style={{ marginTop: 5 }}>Destinatario: <b>{destinatario || "— sin dato —"}</b></div>}
        </div>
        <div className="fl"><label>Plantilla</label>
          <div className="tmpl">{PLANTILLAS.map((t) => <button key={t.id} type="button" className="chip" onClick={() => aplicar(t)}>{t.label}</button>)}</div>
          <textarea className="fi sm" rows={4} placeholder="Escribe o elige una plantilla…" value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
          <div className="txt-muted" style={{ textAlign: "right", marginTop: 3 }}>{mensaje.length} car.</div>
        </div>
        <div className="fl"><label>Programar para (opcional)</label><input className="fi sm" type="datetime-local" value={programar} onChange={(e) => setProgramar(e.target.value)} /></div>

        {error && <div className="txt-sm" style={{ color: "var(--rose)", marginBottom: 10 }}>{error}</div>}
        <div className="flex gap8" style={{ justifyContent: "flex-end" }}>
          <button className="btn-sm sec" type="button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn-sm" type="button" onClick={guardar} disabled={saving}>{saving ? "Encolando…" : "📤 Encolar mensaje"}</button>
        </div>
      </div>
    </div>
  );
}

export default function Notificaciones() {
  const { profile, consultorio, rolUi } = useAuth();
  const consultorioId = profile?.consultorio_id || null;
  const puedeGestionar = rolUi === "admin" || rolUi === "recepcionista";
  const [items, setItems] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [canal, setCanal] = useState("all");
  const [estado, setEstado] = useState("all");
  const [q, setQ] = useState("");
  const [compose, setCompose] = useState(false);
  const [ocupado, setOcupado] = useState(null);

  async function cargar() {
    if (!consultorioId) { setLoading(false); return; }
    setErrorCarga("");
    const [n, p] = await Promise.all([
      supabase.from("notificaciones").select("*").eq("consultorio_id", consultorioId).order("created_at", { ascending: false }).limit(300),
      supabase.from("pacientes").select("id,nombre,telefono,email").eq("consultorio_id", consultorioId).eq("activo", true).order("nombre"),
    ]);
    if (n.error) setErrorCarga(n.error.message);
    setItems(n.data || []);
    setPacientes(p.data || []);
    setLoading(false);
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [consultorioId]);

  const nombrePac = useMemo(() => Object.fromEntries(pacientes.map((p) => [p.id, p.nombre])), [pacientes]);

  const conteo = useMemo(() => {
    const c = { total: items.length, pendiente: 0, enviado: 0, entregado: 0, fallido: 0 };
    items.forEach((i) => { c[i.estado] = (c[i.estado] || 0) + 1; });
    return c;
  }, [items]);

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return items.filter((i) => {
      if (canal !== "all" && i.canal !== canal) return false;
      if (estado !== "all" && i.estado !== estado) return false;
      if (!t) return true;
      return [nombrePac[i.paciente_id], i.destinatario, i.mensaje].some((s) => (s || "").toLowerCase().includes(t));
    });
  }, [items, canal, estado, q, nombrePac]);

  const grupos = useMemo(() => {
    const m = new Map();
    visibles.forEach((i) => {
      const k = claveDia(i.created_at);
      if (!m.has(k)) m.set(k, { label: etiquetaDia(i.created_at), rows: [] });
      m.get(k).rows.push(i);
    });
    return [...m.values()];
  }, [visibles]);

  async function actualizar(id, patch) {
    setOcupado(id);
    const { error } = await supabase.from("notificaciones").update(patch).eq("id", id);
    setOcupado(null);
    if (error) return window.alert("No se pudo actualizar: " + error.message);
    setItems((arr) => arr.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }
  function enviarWhatsApp(n) {
    const tel = soloDigitos(n.destinatario);
    if (!tel) return window.alert("El destinatario no tiene un número válido.");
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(n.mensaje)}`, "_blank", "noopener");
    actualizar(n.id, { estado: "enviado", enviado_en: new Date().toISOString() });
  }
  async function eliminar(n) {
    if (!window.confirm("¿Eliminar esta notificación del historial?")) return;
    const { error } = await supabase.from("notificaciones").delete().eq("id", n.id);
    if (error) return window.alert("No se pudo eliminar: " + error.message);
    setItems((arr) => arr.filter((i) => i.id !== n.id));
  }

  if (!consultorioId) return <div className="pgm"><div className="card"><div className="empty"><div className="ic">🏥</div><div className="t">Sin clínica asociada</div></div></div></div>;

  return (
    <div className="pgm">
      <div className="mh">
        <div>
          <div className="mh-t">🔔 Centro de notificaciones</div>
          <div className="mh-s">Recordatorios, confirmaciones y mensajes a pacientes por WhatsApp, correo y avisos internos</div>
        </div>
        <div className="mh-a">
          <button className="btn-sm sec" onClick={cargar}>⟳ Actualizar</button>
          {puedeGestionar && <button className="btn-sm" onClick={() => setCompose(true)}>+ Nuevo mensaje</button>}
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi t"><div className="kpi-ic">📨</div><div className="kpi-v">{conteo.total}</div><div className="kpi-l">Mensajes registrados</div></div>
        <div className="kpi g"><div className="kpi-ic">✅</div><div className="kpi-v">{conteo.enviado + conteo.entregado}</div><div className="kpi-l">Enviados / entregados</div></div>
        <div className="kpi b"><div className="kpi-ic">⏳</div><div className="kpi-v">{conteo.pendiente}</div><div className="kpi-l">Pendientes en cola</div></div>
        <div className="kpi r"><div className="kpi-ic">⚠️</div><div className="kpi-v">{conteo.fallido}</div><div className="kpi-l">Fallidos</div></div>
      </div>

      <div className="toolbar">
        <div className="search"><input className="fi sm" placeholder="Buscar paciente, destinatario o texto…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="chips">
          <button type="button" className={"chip" + (canal === "all" ? " on" : "")} onClick={() => setCanal("all")}>Todos los canales</button>
          {CANALES.map((c) => <button key={c.v} type="button" className={"chip" + (canal === c.v ? " on" : "")} onClick={() => setCanal(c.v)}>{c.icon} {c.label}</button>)}
        </div>
      </div>
      <div className="toolbar" style={{ marginTop: -4 }}>
        <div className="chips">
          <button type="button" className={"chip" + (estado === "all" ? " on" : "")} onClick={() => setEstado("all")}>Todos los estados</button>
          {ESTADOS.map((e) => <button key={e.v} type="button" className={"chip" + (estado === e.v ? " on" : "")} onClick={() => setEstado(e.v)}>{e.label}<span className="n">{conteo[e.v] || 0}</span></button>)}
        </div>
      </div>

      {errorCarga && <div className="card mb14"><div className="card-b txt-sm" style={{ color: "var(--rose)" }}>No se pudieron cargar las notificaciones: {errorCarga}</div></div>}

      {loading ? (
        <div style={{ display: "grid", gap: 8 }}>{[0, 1, 2, 3].map((i) => <div key={i} className="sk" style={{ height: 76 }} />)}</div>
      ) : grupos.length === 0 ? (
        <div className="card"><div className="empty"><div className="ic">🔔</div><div className="t">{items.length ? "Sin resultados" : "Aún no hay notificaciones"}</div><div className="s">{items.length ? "Cambia los filtros o la búsqueda." : "Cuando el sistema envíe recordatorios o tú encoles un mensaje, el historial aparecerá aquí."}</div>{puedeGestionar && !items.length && <button className="btn-sm" onClick={() => setCompose(true)}>+ Nuevo mensaje</button>}</div></div>
      ) : (
        grupos.map((g) => (
          <div key={g.label}>
            <div className="tl-day">{g.label}</div>
            {g.rows.map((n) => (
              <div key={n.id} className="tl-i">
                <div className={"tl-ic " + n.canal}>{ICONO[n.canal] || "🔔"}</div>
                <div className="tl-main">
                  <div className="tl-top">
                    <span className="tl-who">{nombrePac[n.paciente_id] || n.destinatario}</span>
                    <span className={"st " + n.estado}>{ESTADOS.find((e) => e.v === n.estado)?.label || n.estado}</span>
                    <span className="txt-muted" style={{ marginLeft: "auto" }}>{fmtHora(n.created_at)}</span>
                  </div>
                  <div className="tl-msg">{n.mensaje}</div>
                  <div className="tl-meta">
                    {CANALES.find((c) => c.v === n.canal)?.label} → {n.destinatario}
                    {n.fecha_envio && n.estado === "pendiente" ? ` · programado ${fmtFecha(n.fecha_envio, { day: "2-digit", month: "short" })} ${fmtHora(n.fecha_envio)}` : ""}
                    {n.enviado_en ? ` · enviado ${fmtHora(n.enviado_en)}` : ""}
                  </div>
                  {n.estado === "fallido" && n.detalle && <div className="tl-meta" style={{ color: "var(--rose)" }}>Motivo: {n.detalle}</div>}
                  {puedeGestionar && (
                    <div className="tl-act">
                      {n.canal === "whatsapp" && (n.estado === "pendiente" || n.estado === "fallido") && <button className="btn-sm" type="button" disabled={ocupado === n.id} onClick={() => enviarWhatsApp(n)}>💬 Enviar por WhatsApp</button>}
                      {n.estado === "pendiente" && n.canal !== "whatsapp" && <button className="btn-sm sec" type="button" disabled={ocupado === n.id} onClick={() => actualizar(n.id, { estado: "enviado", enviado_en: new Date().toISOString() })}>✓ Marcar enviada</button>}
                      {n.estado === "fallido" && <button className="btn-sm sec" type="button" disabled={ocupado === n.id} onClick={() => actualizar(n.id, { estado: "pendiente" })}>↻ Reintentar</button>}
                      {rolUi === "admin" && <button className="btn-sm sec" type="button" onClick={() => eliminar(n)} title="Eliminar del historial">🗑</button>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))
      )}
      {!loading && items.length >= 300 && <div className="txt-muted" style={{ textAlign: "center", padding: 14 }}>Mostrando los 300 mensajes más recientes.</div>}

      <ComponerModal open={compose} pacientes={pacientes} clinica={consultorio?.nombre} consultorioId={consultorioId} userId={profile?.id} onClose={() => setCompose(false)} onSaved={() => { setCompose(false); cargar(); }} />
    </div>
  );
}
