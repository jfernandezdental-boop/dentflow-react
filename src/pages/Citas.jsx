import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const ESTADOS = [
  { v: "pendiente", label: "Pendiente", color: "var(--gold)", tag: "ta" },
  { v: "confirmada", label: "Confirmada", color: "var(--teal)", tag: "tg" },
  { v: "completada", label: "Completada", color: "var(--muted)", tag: "tg" },
  { v: "cancelada", label: "Cancelada", color: "var(--rose)", tag: "tr" },
  { v: "no_asistio", label: "No asistió", color: "var(--rose)", tag: "tr" },
];
const DURACIONES = [15, 30, 45, 60, 90];

function estadoInfo(v) {
  return ESTADOS.find((e) => e.v === v) || ESTADOS[0];
}
function pad(n) {
  return String(n).padStart(2, "0");
}
function toKey(y, m, d) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}
function timeToMin(t) {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return h * 60 + m;
}
function minToTime(m) {
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

function buildMonthGrid(year, month) {
  // Lunes como primer día. month es 0-11.
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // 0=lunes
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// --- Vistas Semana/Día: mismo rango horario y geometría que el original
// (8:00–19:00, franjas de 48px por hora) para reusar tal cual las clases
// .cw-*/.cd-* que ya vienen en global.css.
const HORA_INICIO_AGENDA = 8;
const HORA_FIN_AGENDA = 19;
const ALTURA_HORA = 48;

function addDays(y, m, d, n) {
  const dt = new Date(y, m, d);
  dt.setDate(dt.getDate() + n);
  return { y: dt.getFullYear(), m: dt.getMonth(), d: dt.getDate() };
}
/** Lunes de la semana que contiene year-month-day. */
function weekStart(y, m, d) {
  const dt = new Date(y, m, d);
  const offset = (dt.getDay() + 6) % 7; // 0 = lunes
  return addDays(y, m, d, -offset);
}

function CitaModal({ open, editing, defaultDate, defaultHora, consultorioId, pacientes, doctores, onClose, onSaved }) {
  const [pacienteId, setPacienteId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("08:00");
  const [duracion, setDuracion] = useState(30);
  const [motivo, setMotivo] = useState("");
  const [estado, setEstado] = useState("pendiente");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setPacienteId(editing.paciente_id || "");
      setDoctorId(editing.doctor_id || "");
      setFecha(editing.fecha || "");
      setHora((editing.hora_inicio || "08:00").slice(0, 5));
      setDuracion(timeToMin(editing.hora_fin) - timeToMin(editing.hora_inicio) || 30);
      setMotivo(editing.motivo || "");
      setEstado(editing.estado || "pendiente");
      setNotas(editing.notas || "");
    } else {
      setPacienteId("");
      setDoctorId(doctores[0]?.id || "");
      setFecha(defaultDate || "");
      setHora(defaultHora || "08:00");
      setDuracion(30);
      setMotivo("");
      setEstado("pendiente");
      setNotas("");
    }
    setError("");
  }, [open, editing, defaultDate, defaultHora, doctores]);

  if (!open) return null;

  async function guardar() {
    if (!pacienteId || !doctorId || !fecha || !hora) {
      setError("Paciente, doctor, fecha y hora son obligatorios.");
      return;
    }
    setSaving(true);
    setError("");
    const horaFin = minToTime(timeToMin(hora) + parseInt(duracion, 10));
    const payload = {
      paciente_id: pacienteId,
      doctor_id: doctorId,
      fecha,
      hora_inicio: hora,
      hora_fin: horaFin,
      motivo: motivo || null,
      estado,
      notas: notas || null,
    };
    let res;
    if (editing) {
      res = await supabase.from("citas").update(payload).eq("id", editing.id);
    } else {
      payload.consultorio_id = consultorioId;
      res = await supabase.from("citas").insert(payload);
    }
    setSaving(false);
    if (res.error) {
      setError("No se pudo guardar: " + res.error.message);
      return;
    }
    onSaved();
  }

  async function cancelar() {
    if (!editing) return;
    if (!window.confirm("¿Cancelar esta cita? Quedará marcada como cancelada y se conserva en el historial.")) return;
    setSaving(true);
    const { error: err } = await supabase.from("citas").update({ estado: "cancelada" }).eq("id", editing.id);
    setSaving(false);
    if (err) {
      setError("No se pudo cancelar: " + err.message);
      return;
    }
    onSaved();
  }

  return (
    <div className="appt-modal on">
      <div className="appt-box" style={{ width: 480, maxHeight: "90vh", overflowY: "auto" }}>
        <div className="appt-box-title">{editing ? "✏️ Editar cita" : "📅 Agendar cita"}</div>
        <div className="appt-box-sub">{fecha || defaultDate} · {hora}</div>

        {editing && (
          <div className="appt-modal-edit-bar" style={{ display: "flex" }}>
            <div className="appt-edit-badge">✏️ Editando cita</div>
            <button className="btn-delete-appt" type="button" onClick={cancelar} disabled={saving}>
              🗑 Cancelar cita
            </button>
          </div>
        )}

        <div className="fl">
          <label>Paciente</label>
          <select className="fi sm" value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}>
            <option value="">Selecciona…</option>
            {pacientes.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>

        <div className="fl">
          <label>Doctor</label>
          <select className="fi sm" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            <option value="">Selecciona…</option>
            {doctores.map((d) => (
              <option key={d.id} value={d.id}>{d.nombre}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div className="fl" style={{ margin: 0 }}>
            <label>Fecha</label>
            <input className="fi sm" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="fl" style={{ margin: 0 }}>
            <label>Hora</label>
            <input className="fi sm" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>
          <div className="fl" style={{ margin: 0 }}>
            <label>Duración</label>
            <select className="fi sm" value={duracion} onChange={(e) => setDuracion(e.target.value)}>
              {DURACIONES.map((m) => (
                <option key={m} value={m}>{m} min</option>
              ))}
            </select>
          </div>
        </div>

        <div className="fl">
          <label>Motivo</label>
          <input className="fi sm" placeholder="Ej: Limpieza, control, dolor…" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>

        <div className="fl">
          <label>Estado</label>
          <select className="fi sm" value={estado} onChange={(e) => setEstado(e.target.value)}>
            {ESTADOS.map((e2) => (
              <option key={e2.v} value={e2.v}>{e2.label}</option>
            ))}
          </select>
        </div>

        <div className="fl">
          <label>Notas</label>
          <textarea className="fi" rows={2} style={{ resize: "vertical" }} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </div>

        {error && (
          <div className="txt-sm" style={{ color: "var(--rose)", marginBottom: 10 }}>
            {error}
          </div>
        )}

        <div className="flex gap8" style={{ justifyContent: "flex-end" }}>
          <button className="btn-sm sec" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="btn-sm" type="button" onClick={guardar} disabled={saving}>
            {saving ? "Guardando…" : editing ? "✓ Guardar cambios" : "✓ Confirmar cita"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Citas() {
  const { profile } = useAuth();
  const consultorioId = profile?.consultorio_id || null;
  const hoy = new Date();

  const [year, setYear] = useState(hoy.getFullYear());
  const [month, setMonth] = useState(hoy.getMonth());
  const [vista, setVista] = useState("mes"); // 'dia' | 'semana' | 'mes' | 'lista'
  const [citas, setCitas] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [doctores, setDoctores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [modalFecha, setModalFecha] = useState("");
  const [modalHora, setModalHora] = useState("");

  // Rango real de fechas a traer de Supabase según la vista activa — un
  // día, una semana o el mes completo (Lista reusa el rango del mes).
  const rango = useMemo(() => {
    const base = diaSeleccionado || hoy.getDate();
    if (vista === "dia") {
      const key = toKey(year, month, base);
      return { desde: key, hasta: key };
    }
    if (vista === "semana") {
      const ws = weekStart(year, month, base);
      const we = addDays(ws.y, ws.m, ws.d, 6);
      return { desde: toKey(ws.y, ws.m, ws.d), hasta: toKey(we.y, we.m, we.d) };
    }
    const inicioMes = toKey(year, month, 1);
    const finMes = toKey(year, month, new Date(year, month + 1, 0).getDate());
    return { desde: inicioMes, hasta: finMes };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, year, month, diaSeleccionado]);

  // Los 7 días (lun-dom) de la semana que contiene al día seleccionado —
  // para pintar las columnas de la vista Semana.
  const diasSemana = useMemo(() => {
    const base = diaSeleccionado || hoy.getDate();
    const ws = weekStart(year, month, base);
    const arr = [];
    for (let i = 0; i < 7; i++) {
      const nd = addDays(ws.y, ws.m, ws.d, i);
      arr.push({ ...nd, key: toKey(nd.y, nd.m, nd.d) });
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, diaSeleccionado]);

  async function cargar() {
    if (!consultorioId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: citasData }, { data: pacData }, { data: docData }] = await Promise.all([
      supabase
        .from("citas")
        .select("*, pacientes(nombre), doctores(nombre,color)")
        .eq("consultorio_id", consultorioId)
        .gte("fecha", rango.desde)
        .lte("fecha", rango.hasta)
        .order("hora_inicio"),
      supabase.from("pacientes").select("id,nombre").eq("consultorio_id", consultorioId).eq("activo", true).order("nombre"),
      supabase.from("doctores").select("id,nombre,color").eq("consultorio_id", consultorioId).eq("activo", true).order("nombre"),
    ]);
    setCitas(citasData || []);
    setPacientes(pacData || []);
    setDoctores(docData || []);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultorioId, rango.desde, rango.hasta]);

  const citasPorDia = useMemo(() => {
    const map = {};
    for (const c of citas) {
      (map[c.fecha] = map[c.fecha] || []).push(c);
    }
    return map;
  }, [citas]);

  const citasFiltradas = useMemo(() => {
    return citas.filter((c) => !filtroEstado || c.estado === filtroEstado);
  }, [citas, filtroEstado]);

  /** Anterior/siguiente: un día, una semana o un mes según la vista activa. */
  function navegar(dir) {
    if (vista === "dia") {
      const nd = addDays(year, month, diaSeleccionado || hoy.getDate(), dir);
      setYear(nd.y); setMonth(nd.m); setDiaSeleccionado(nd.d);
      return;
    }
    if (vista === "semana") {
      const nd = addDays(year, month, diaSeleccionado || hoy.getDate(), dir * 7);
      setYear(nd.y); setMonth(nd.m); setDiaSeleccionado(nd.d);
      return;
    }
    let m = month + dir;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m);
    setYear(y);
    setDiaSeleccionado(null);
  }
  function irHoy() {
    setYear(hoy.getFullYear());
    setMonth(hoy.getMonth());
    setDiaSeleccionado(hoy.getDate());
  }
  function cambiarVista(v) {
    setVista(v);
    if ((v === "dia" || v === "semana") && !diaSeleccionado) {
      setDiaSeleccionado(hoy.getDate());
    }
  }
  /** Título sobre el calendario: fecha completa, rango de semana, o "Mes año". */
  function tituloRango() {
    const base = diaSeleccionado || hoy.getDate();
    if (vista === "dia") {
      const dt = new Date(year, month, base);
      const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
      return `${dias[dt.getDay()]} ${base} de ${MESES[month]} ${year}`;
    }
    if (vista === "semana") {
      const ws = weekStart(year, month, base);
      const we = addDays(ws.y, ws.m, ws.d, 6);
      const mismoMes = ws.m === we.m;
      return `Semana ${ws.d}${mismoMes ? "" : " " + MESES[ws.m].slice(0, 3)}–${we.d} ${MESES[we.m].slice(0, 3)} ${we.y}`;
    }
    return `${MESES[month]} ${year}`;
  }

  function abrirNueva(dateKey, hora) {
    setEditing(null);
    setModalFecha(dateKey || toKey(year, month, diaSeleccionado || hoy.getDate()));
    setModalHora(hora || "");
    setModalOpen(true);
  }
  function abrirEditar(c) {
    setEditing(c);
    setModalFecha(c.fecha);
    setModalOpen(true);
  }
  function cerrarModal() {
    setModalOpen(false);
    setEditing(null);
    setModalHora("");
  }
  async function alGuardar() {
    cerrarModal();
    await cargar();
  }

  const cells = buildMonthGrid(year, month);
  const citasDelDiaSeleccionado = diaSeleccionado ? citasPorDia[toKey(year, month, diaSeleccionado)] || [] : [];

  return (
    <div style={{ padding: 28 }}>
      <div className="flex items-c jc-b mb14">
        <div>
          <div className="fw7" style={{ fontSize: 16 }}>📋 Calendario de Citas</div>
          <div className="txt-muted" style={{ fontSize: 12, marginTop: 2 }}>Agenda multi-doctor</div>
        </div>
        <div className="flex gap8">
          <div className="cal-view-toggle" role="tablist">
            <button type="button" className={"cvt-btn" + (vista === "dia" ? " on" : "")} onClick={() => cambiarVista("dia")}>Día</button>
            <button type="button" className={"cvt-btn" + (vista === "semana" ? " on" : "")} onClick={() => cambiarVista("semana")}>Semana</button>
            <button type="button" className={"cvt-btn" + (vista === "mes" ? " on" : "")} onClick={() => cambiarVista("mes")}>Mes</button>
            <button type="button" className={"cvt-btn" + (vista === "lista" ? " on" : "")} onClick={() => cambiarVista("lista")}>Lista</button>
          </div>
          <button className="btn-sm" onClick={() => abrirNueva()}>+ Nueva cita</button>
        </div>
      </div>

      {(vista === "dia" || vista === "semana" || vista === "mes") && (
        <div className="cal-view-bar">
          <div className="cal-view-nav">
            <button className="cal-nb" onClick={() => navegar(-1)} title="Anterior">‹</button>
            <button className="btn-sm sec" onClick={irHoy} style={{ padding: "6px 12px", fontSize: 12 }}>Hoy</button>
            <button className="cal-nb" onClick={() => navegar(1)} title="Siguiente">›</button>
            <div className="cal-month" style={{ marginLeft: 8, minWidth: 160 }}>{tituloRango()}</div>
          </div>
        </div>
      )}

      {vista === "dia" && (
        <div className="cal-wrap cal-wrap-full">
          <div className="cal-day-header">
            <div>
              <div className="cdh-title">{tituloRango()}</div>
              <div className="cdh-meta">
                {(citasPorDia[toKey(year, month, diaSeleccionado || hoy.getDate())] || []).length} cita(s) programada(s) · clic en un hueco libre para agendar
              </div>
            </div>
            <button className="btn-sm" onClick={() => abrirNueva(toKey(year, month, diaSeleccionado || hoy.getDate()))}>+ Nueva cita este día</button>
          </div>
          <div className="cal-day-timeline">
            {(() => {
              const diaKey = toKey(year, month, diaSeleccionado || hoy.getDate());
              const appts = (citasPorDia[diaKey] || []).slice().sort((a, b) => (a.hora_inicio || "").localeCompare(b.hora_inicio || ""));
              const slots = [];
              for (let h = HORA_INICIO_AGENDA; h <= HORA_FIN_AGENDA; h++) {
                slots.push(`${pad(h)}:00`, `${pad(h)}:30`);
              }
              const filas = [];
              for (const t of slots) {
                const tm = timeToMin(t);
                const booked = appts.find((a) => tm >= timeToMin(a.hora_inicio) && tm < timeToMin(a.hora_fin));
                if (booked) {
                  if (tm > timeToMin(booked.hora_inicio)) continue; // ya se mostró en su slot de inicio
                  filas.push(
                    <div className="cd-slot" key={t}>
                      <div className="cd-time">{booked.hora_inicio?.slice(0, 5)}</div>
                      <div className="cd-bar booked" style={{ borderLeftColor: booked.doctores?.color || "var(--teal)" }} onClick={() => abrirEditar(booked)}>
                        <div>
                          <div className="cd-pt">{booked.pacientes?.nombre || "?"}</div>
                          <div className="cd-proc">{booked.motivo || "Consulta"} · {booked.doctores?.nombre || "—"}</div>
                        </div>
                        <span className="cd-dur">{timeToMin(booked.hora_fin) - timeToMin(booked.hora_inicio)} min</span>
                      </div>
                    </div>
                  );
                } else {
                  filas.push(
                    <div className="cd-slot" key={t}>
                      <div className="cd-time">{t}</div>
                      <div className="cd-bar free" onClick={() => abrirNueva(diaKey, t)}>Disponible · agendar cita</div>
                    </div>
                  );
                }
              }
              return filas;
            })()}
          </div>
        </div>
      )}

      {vista === "semana" && (
        <div className="cal-wrap cal-wrap-full">
          <div className="cal-week-grid">
            <div className="cw-hours">
              <div className="cw-day-head" style={{ height: 54 }} />
              {Array.from({ length: HORA_FIN_AGENDA - HORA_INICIO_AGENDA + 1 }, (_, i) => HORA_INICIO_AGENDA + i).map((h) => (
                <div className="cw-hour-lbl" key={h}>{pad(h)}:00</div>
              ))}
            </div>
            {diasSemana.map((dia, i) => {
              const esHoy = dia.key === toKey(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
              const appts = citasPorDia[dia.key] || [];
              return (
                <div className="cw-day-col" key={dia.key}>
                  <div className="cw-day-head">
                    <div className="cw-day-name">{DIAS[i]}</div>
                    <div className={"cw-day-num" + (esHoy ? " today" : "")}>{dia.d}</div>
                  </div>
                  <div style={{ position: "relative" }}>
                    {Array.from({ length: HORA_FIN_AGENDA - HORA_INICIO_AGENDA + 1 }, (_, h) => h).map((h) => (
                      <div
                        key={h}
                        className="cw-slot"
                        onClick={() => { setYear(dia.y); setMonth(dia.m); setDiaSeleccionado(dia.d); setVista("dia"); }}
                      />
                    ))}
                    {appts.map((c) => {
                      const s = timeToMin(c.hora_inicio);
                      const e = timeToMin(c.hora_fin);
                      const top = ((s - HORA_INICIO_AGENDA * 60) / 60) * ALTURA_HORA;
                      const hgt = Math.max(22, ((e - s) / 60) * ALTURA_HORA - 2);
                      return (
                        <div
                          key={c.id}
                          className="cw-appt"
                          style={{ top, height: hgt, background: c.doctores?.color || "#076E6E" }}
                          title={`${c.hora_inicio?.slice(0, 5)} · ${c.pacientes?.nombre || "?"}`}
                          onClick={(e2) => { e2.stopPropagation(); abrirEditar(c); }}
                        >
                          <div className="t">{c.hora_inicio?.slice(0, 5)}</div>
                          {(c.pacientes?.nombre || "?").split(" ")[0]} · {(c.motivo || "").slice(0, 18)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {vista === "mes" && (
        <>
          <div className="cal-wrap cal-wrap-full">
            <div className="cal-wdays">
              {DIAS.map((d) => <div className="cal-wd" key={d}>{d}</div>)}
            </div>
            <div className="cal-days cal-days-full">
              {cells.map((d, i) => {
                if (!d) return <div className="cal-df" key={i} style={{ visibility: "hidden" }} />;
                const key = toKey(year, month, d);
                const delDia = citasPorDia[key] || [];
                const esHoy = key === toKey(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
                return (
                  <div
                    className={"cal-df" + (esHoy ? " today" : "") + (diaSeleccionado === d ? " sel" : "")}
                    key={i}
                    onClick={() => setDiaSeleccionado(d)}
                    onDoubleClick={() => abrirNueva(key)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="cal-df-num">{d}</div>
                    {delDia.slice(0, 3).map((c) => (
                      <div
                        key={c.id}
                        className="cal-appt-pill"
                        style={{ background: estadoInfo(c.estado).color }}
                        title={`${c.hora_inicio?.slice(0, 5)} · ${c.pacientes?.nombre || "?"}`}
                        onClick={(e) => { e.stopPropagation(); abrirEditar(c); }}
                      >
                        {c.hora_inicio?.slice(0, 5)} {c.pacientes?.nombre || "?"}
                      </div>
                    ))}
                    {delDia.length > 3 && <div className="cal-appt-more">+{delDia.length - 3} más</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {diaSeleccionado && (
            <div className="card mt14">
              <div className="card-h" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="card-t">{diaSeleccionado} de {MESES[month]}</div>
                <button className="btn-sm sec" onClick={() => abrirNueva(toKey(year, month, diaSeleccionado))} style={{ fontSize: 12 }}>
                  + Cita este día
                </button>
              </div>
              <div className="card-b" style={{ padding: 0 }}>
                {citasDelDiaSeleccionado.length === 0 && (
                  <div className="txt-muted txt-sm" style={{ padding: 16 }}>Sin citas este día.</div>
                )}
                {citasDelDiaSeleccionado.map((c) => (
                  <div key={c.id} className="flex items-c jc-b" style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", cursor: "pointer" }} onClick={() => abrirEditar(c)}>
                    <div>
                      <div className="fw6 txt-sm">{c.hora_inicio?.slice(0, 5)} — {c.pacientes?.nombre || "?"}</div>
                      <div className="txt-muted" style={{ fontSize: 12 }}>{c.doctores?.nombre || "?"} · {c.motivo || "Consulta"}</div>
                    </div>
                    <span className={"tag " + estadoInfo(c.estado).tag}>{estadoInfo(c.estado).label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {vista === "lista" && (
        <div className="card mt14">
          <div className="card-h" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="card-t">📋 Listado de citas — {MESES[month]} {year}</div>
            <select className="fi sm" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ width: 180 }}>
              <option value="">Todos los estados</option>
              {ESTADOS.map((e) => (
                <option key={e.v} value={e.v}>{e.label}</option>
              ))}
            </select>
          </div>
          <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
            <table style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>Paciente</th><th>Doctor</th><th>Fecha / Hora</th><th>Motivo</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={5} className="txt-muted" style={{ padding: 20 }}>Cargando…</td></tr>
                )}
                {!loading && citasFiltradas.length === 0 && (
                  <tr><td colSpan={5} className="txt-muted" style={{ padding: 20 }}>Sin citas para este filtro.</td></tr>
                )}
                {!loading && citasFiltradas.map((c) => (
                  <tr key={c.id} onClick={() => abrirEditar(c)} style={{ cursor: "pointer" }}>
                    <td className="fw6">{c.pacientes?.nombre || "?"}</td>
                    <td>{c.doctores?.nombre || "?"}</td>
                    <td>{c.fecha} · {c.hora_inicio?.slice(0, 5)}</td>
                    <td>{c.motivo || "—"}</td>
                    <td><span className={"tag " + estadoInfo(c.estado).tag}>{estadoInfo(c.estado).label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CitaModal
        open={modalOpen}
        editing={editing}
        defaultDate={modalFecha}
        defaultHora={modalHora}
        consultorioId={consultorioId}
        pacientes={pacientes}
        doctores={doctores}
        onClose={cerrarModal}
        onSaved={alGuardar}
      />
    </div>
  );
}
