import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { hoyISO, fmtFecha } from "../lib/format";
import {
  pad, parseIso, addDaysIso, mondayOf, addMonthsIso, monthCells,
  timeToMin, minToTime, layoutCitas, rangoHoras,
} from "../lib/agendaUtils";
import "../styles/agenda.css";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DIAS_INI = ["L", "M", "X", "J", "V", "S", "D"];
const DIAS_LARGO = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const ESTADOS = [
  { v: "pendiente", label: "Pendiente", tag: "ta" },
  { v: "confirmada", label: "Confirmada", tag: "tg" },
  { v: "completada", label: "Completada", tag: "tg" },
  { v: "no_asistio", label: "No asistió", tag: "tr" },
  { v: "cancelada", label: "Cancelada", tag: "tr" },
];
const DURACIONES = [15, 30, 45, 60, 90];
const estadoInfo = (v) => ESTADOS.find((e) => e.v === v) || ESTADOS[0];
const hhmm = (t) => (t || "").slice(0, 5);
const nombreDe = (c) => c.pacientes?.nombre || "Paciente";

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


// ───────── Tarjeta de cita dentro de la rejilla horaria ─────────
function Evento({ it, h0, row, mostrarDoctor, onOpen }) {
  const { c, s, e, col, cols } = it;
  const top = ((s - h0 * 60) / 60) * row;
  const alto = Math.max(26, ((e - s) / 60) * row - 3);
  return (
    <button
      type="button"
      className={"ax-ev ax-st-" + c.estado + " " + c.estado}
      style={{
        top: top + 1,
        height: alto,
        left: `calc(${(col / cols) * 100}% + 2px)`,
        width: `calc(${100 / cols}% - 4px)`,
        "--dc": c.doctores?.color || "var(--teal)",
      }}
      title={`${hhmm(c.hora_inicio)} · ${nombreDe(c)} · ${c.motivo || "Consulta"}`}
      onClick={(ev) => { ev.stopPropagation(); onOpen(c.id); }}
    >
      <div className="r1">
        <span className="nm">{nombreDe(c)}</span>
        <span className="tm">{hhmm(c.hora_inicio)}</span>
      </div>
      {alto > 40 && <div className="r2">{c.motivo || "Consulta"}</div>}
      {alto > 56 && mostrarDoctor && <div className="r2">{c.doctores?.nombre || "—"}</div>}
    </button>
  );
}

function Lineas({ h0, h1, row, conEtiqueta }) {
  const out = [];
  for (let h = h0; h <= h1; h++) {
    out.push(
      <div key={h} className="ax-hr" style={{ top: (h - h0) * row, height: row }}>
        {conEtiqueta && <span>{pad(h)}:00</span>}
      </div>
    );
  }
  return out;
}

function Huecos({ fecha, h0, h1, row, onSlot, etiqueta }) {
  const out = [];
  for (let h = h0; h <= h1; h++) {
    for (const mm of [0, 30]) {
      const t = `${pad(h)}:${pad(mm)}`;
      out.push(
        <button
          key={t}
          type="button"
          className="ax-slot"
          aria-label={`Agendar ${fecha} ${t}`}
          style={{ top: (h - h0) * row + (mm / 60) * row, height: row / 2 }}
          onClick={() => onSlot(fecha, t)}
        >
          {etiqueta && <span>+ Agendar {t}</span>}
        </button>
      );
    }
  }
  return out;
}

function LineaAhora({ fecha, h0, h1, row }) {
  if (fecha !== hoyISO()) return null;
  const n = new Date();
  const m = n.getHours() * 60 + n.getMinutes();
  if (m < h0 * 60 || m >= (h1 + 1) * 60) return null;
  return <div className="ax-now" style={{ top: ((m - h0 * 60) / 60) * row }} />;
}

// ───────── Vista Día ─────────
function VistaDia({ fecha, citas, mostrarDoctor, onSlot, onOpen }) {
  const ROW = 72;
  const [h0, h1] = rangoHoras(citas);
  const items = useMemo(() => layoutCitas(citas), [citas]);
  return (
    <div className="ax-scroll">
      <div className="ax-day" style={{ height: (h1 - h0 + 1) * ROW }}>
        <Lineas h0={h0} h1={h1} row={ROW} conEtiqueta />
        <div className="ax-lane">
          <Huecos fecha={fecha} h0={h0} h1={h1} row={ROW} onSlot={onSlot} etiqueta />
          {items.map((it) => (
            <Evento key={it.c.id} it={it} h0={h0} row={ROW} mostrarDoctor={mostrarDoctor} onOpen={onOpen} />
          ))}
        </div>
        <LineaAhora fecha={fecha} h0={h0} h1={h1} row={ROW} />
      </div>
    </div>
  );
}

// ───────── Vista Semana ─────────
function VistaSemana({ fecha, porDia, todas, mostrarDoctor, onSlot, onOpen, onDia }) {
  const ROW = 60;
  const lunes = mondayOf(fecha);
  const dias = Array.from({ length: 7 }, (_, i) => addDaysIso(lunes, i));
  const hoy = hoyISO();
  const semana = dias.flatMap((d) => porDia[d] || []);
  const [h0, h1] = rangoHoras(semana);
  const horas = Array.from({ length: h1 - h0 + 1 }, (_, i) => h0 + i);
  return (
    <div className="ax-scroll">
      <div className="ax-wk">
        <div className="ax-wk-head">
          <div />
          {dias.map((d, i) => (
            <div
              key={d}
              className={"ax-wk-hd" + (d === hoy ? " today" : "") + (d === fecha ? " sel" : "")}
              onClick={() => onDia(d)}
            >
              <div className="d">{DIAS[i]}</div>
              <div className="n">{Number(d.slice(8))}</div>
              <div className="c">{(porDia[d] || []).length} citas</div>
            </div>
          ))}
        </div>
        <div className="ax-wk-body" style={{ height: horas.length * ROW }}>
          <div className="ax-wk-hours">
            {horas.map((h) => (
              <span key={h} style={{ top: (h - h0) * ROW }}>{pad(h)}:00</span>
            ))}
          </div>
          {dias.map((d) => (
            <div key={d} className="ax-wk-col">
              <Lineas h0={h0} h1={h1} row={ROW} />
              <Huecos fecha={d} h0={h0} h1={h1} row={ROW} onSlot={onSlot} />
              {layoutCitas(porDia[d] || []).map((it) => (
                <Evento key={it.c.id} it={it} h0={h0} row={ROW} mostrarDoctor={false} onOpen={onOpen} />
              ))}
              <LineaAhora fecha={d} h0={h0} h1={h1} row={ROW} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ───────── Vista Mes ─────────
function VistaMes({ fecha, celdas, porDia, onDia, onNueva, onOpen }) {
  const hoy = hoyISO();
  return (
    <div className="ax-mo">
      <div className="ax-mo-grid">
        {DIAS.map((d) => <div className="ax-mo-wd" key={d}>{d}</div>)}
        {celdas.map((c) => {
          const lista = porDia[c.iso] || [];
          return (
            <div
              key={c.iso}
              className={"ax-mo-c" + (c.inMonth ? "" : " out") + (c.iso === fecha ? " sel" : "") + (c.iso === hoy ? " today" : "")}
              onClick={() => onDia(c.iso)}
            >
              <div className="ax-mo-top">
                <span className="ax-mo-n">{c.num}</span>
                <button
                  type="button"
                  className="ax-mo-add"
                  aria-label={`Agendar cita el ${c.iso}`}
                  onClick={(e) => { e.stopPropagation(); onNueva(c.iso); }}
                >+</button>
              </div>
              {lista.slice(0, 2).map((x) => (
                <div
                  key={x.id}
                  className={"ax-mo-i ax-st-" + x.estado}
                  onClick={(e) => { e.stopPropagation(); onOpen(x.id); }}
                >
                  <i /><b>{hhmm(x.hora_inicio)}</b><span>{nombreDe(x).split(" ")[0]}</span>
                </div>
              ))}
              {lista.length > 2 && <div className="ax-mo-more">+{lista.length - 2} más</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ───────── Panel de detalle de una cita ─────────
function Detalle({ cita, onClose, onEstado, onEditar, irA }) {
  const dur = timeToMin(cita.hora_fin) - timeToMin(cita.hora_inicio);
  return (
    <>
      <div className="ax-dr-ov" onClick={onClose} />
      <aside className="ax-dr" role="dialog" aria-label="Detalle de la cita">
        <div className="ax-dr-h">
          <div>
            <div className="ax-dr-k">Cita · {fmtFecha(cita.fecha)}</div>
            <div className="ax-dr-n">{nombreDe(cita)}</div>
          </div>
          <button type="button" className="ax-dr-x" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="ax-dr-b">
          <dl className="ax-dr-g">
            <div><dt>Fecha</dt><dd>{fmtFecha(cita.fecha)}</dd></div>
            <div><dt>Horario</dt><dd>{hhmm(cita.hora_inicio)} – {hhmm(cita.hora_fin)}</dd></div>
            <div><dt>Odontólogo</dt><dd>{cita.doctores?.nombre || "—"}</dd></div>
            <div><dt>Duración</dt><dd>{dur > 0 ? dur + " min" : "—"}</dd></div>
            <div style={{ gridColumn: "1 / -1" }}><dt>Motivo</dt><dd>{cita.motivo || "Consulta"}</dd></div>
          </dl>
          {cita.notas && <div className="ax-dr-notas">{cita.notas}</div>}
          <div>
            <div className="ax-dr-sl">Estado de la cita</div>
            <div className="ax-chips">
              {ESTADOS.map((e) => (
                <button
                  key={e.v}
                  type="button"
                  className={"ax-chip ax-st-" + e.v + (cita.estado === e.v ? " on" : "")}
                  onClick={() => onEstado(cita, e.v)}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="ax-dr-f">
          <button type="button" className="btn-sm" onClick={() => onEditar(cita)}>✏️ Editar cita</button>
          {irA && <button type="button" className="btn-sm sec" onClick={() => irA("historia")}>Historia clínica</button>}
          {irA && <button type="button" className="btn-sm sec" onClick={() => irA("odontograma")}>Odontograma</button>}
        </div>
      </aside>
    </>
  );
}

// ───────── Mini calendario lateral ─────────
function MiniCalendario({ fecha, celdas, porDia, onDia, onMes, onNueva, nDia }) {
  const hoy = hoyISO();
  const d = parseIso(fecha);
  return (
    <div className="ax-card ax-mini">
      <div className="ax-mini-h">
        <div className="ax-mini-t">{MESES[d.getMonth()]} {d.getFullYear()}</div>
        <div className="flex gap8">
          <button type="button" className="ax-nb" onClick={() => onMes(-1)} aria-label="Mes anterior">‹</button>
          <button type="button" className="ax-nb" onClick={() => onMes(1)} aria-label="Mes siguiente">›</button>
        </div>
      </div>
      <div className="ax-mini-grid">
        {DIAS_INI.map((x) => <span className="ax-mini-wd" key={x}>{x}</span>)}
        {celdas.map((c) => (
          <button
            key={c.iso}
            type="button"
            className={"ax-mini-d" + (c.inMonth ? "" : " out") + (c.iso === fecha ? " sel" : "") + (c.iso === hoy ? " today" : "")}
            onClick={() => onDia(c.iso)}
          >
            {c.num}
            {(porDia[c.iso] || []).length > 0 && c.iso !== fecha && <span className="dot" />}
          </button>
        ))}
      </div>
      <div className="ax-mini-foot">
        <span><strong>{nDia}</strong> citas ese día</span>
        <button type="button" onClick={onNueva}>Agendar aquí</button>
      </div>
    </div>
  );
}

export default function Citas({ irA }) {
  const { profile } = useAuth();
  const consultorioId = profile?.consultorio_id || null;

  const [fecha, setFecha] = useState(hoyISO()); // día seleccionado / cursor
  const [vista, setVista] = useState("dia"); // 'dia' | 'semana' | 'mes' | 'lista'
  const [doctorId, setDoctorId] = useState("");
  const [citas, setCitas] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [doctores, setDoctores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aviso, setAviso] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [selId, setSelId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [modalFecha, setModalFecha] = useState("");
  const [modalHora, setModalHora] = useState("");

  // Las 42 celdas del mes del cursor: sirven al mini calendario, a la vista Mes y fijan
  // el rango que se pide a Supabase (cubre también la semana y el día del cursor).
  const celdas = useMemo(() => monthCells(fecha), [fecha]);
  const desde = celdas[0].iso;
  const hasta = celdas[41].iso;

  async function cargarCitas() {
    if (!consultorioId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("citas")
      .select("*, pacientes(nombre), doctores(nombre,color)")
      .eq("consultorio_id", consultorioId)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("hora_inicio");
    if (error) setAviso("No se pudo cargar la agenda: " + error.message);
    setCitas(data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!consultorioId) return;
    (async () => {
      const [{ data: pac }, { data: doc }] = await Promise.all([
        supabase.from("pacientes").select("id,nombre").eq("consultorio_id", consultorioId).eq("activo", true).order("nombre"),
        supabase.from("doctores").select("id,nombre,color").eq("consultorio_id", consultorioId).eq("activo", true).order("nombre"),
      ]);
      setPacientes(pac || []);
      setDoctores(doc || []);
    })();
  }, [consultorioId]);

  useEffect(() => {
    cargarCitas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultorioId, desde, hasta]);

  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(""), 5000);
    return () => clearTimeout(t);
  }, [aviso]);

  const visibles = useMemo(
    () => citas.filter((c) => !doctorId || c.doctor_id === doctorId),
    [citas, doctorId]
  );
  const porDia = useMemo(() => {
    const m = {};
    for (const c of visibles) (m[c.fecha] = m[c.fecha] || []).push(c);
    return m;
  }, [visibles]);
  const delDia = porDia[fecha] || [];
  const seleccionada = selId ? citas.find((c) => c.id === selId) || null : null;

  function mover(dir) {
    if (vista === "dia") setFecha(addDaysIso(fecha, dir));
    else if (vista === "semana") setFecha(addDaysIso(fecha, dir * 7));
    else setFecha(addMonthsIso(fecha, dir));
  }
  function titulo() {
    const d = parseIso(fecha);
    if (vista === "dia") return `${DIAS_LARGO[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`;
    if (vista === "semana") {
      const s = parseIso(mondayOf(fecha));
      const e = parseIso(addDaysIso(mondayOf(fecha), 6));
      const mes = (x) => MESES[x.getMonth()].slice(0, 3).toLowerCase();
      return `${s.getDate()} ${mes(s)} – ${e.getDate()} ${mes(e)} ${e.getFullYear()}`;
    }
    return `${MESES[d.getMonth()]} ${d.getFullYear()}`;
  }

  function abrirNueva(dia, hora) {
    setEditing(null);
    setSelId(null);
    setModalFecha(dia || fecha);
    setModalHora(hora || "");
    setModalOpen(true);
  }
  function abrirEditar(c) {
    setSelId(null);
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
    await cargarCitas();
  }
  async function cambiarEstado(c, estado) {
    const previo = c.estado;
    setCitas((cs) => cs.map((x) => (x.id === c.id ? { ...x, estado } : x)));
    const { error } = await supabase.from("citas").update({ estado }).eq("id", c.id);
    if (error) {
      setCitas((cs) => cs.map((x) => (x.id === c.id ? { ...x, estado: previo } : x)));
      setAviso("No se pudo cambiar el estado: " + error.message);
    }
  }

  const listaFiltrada = visibles
    .filter((c) => c.fecha.slice(0, 7) === fecha.slice(0, 7))
    .filter((c) => !filtroEstado || c.estado === filtroEstado)
    .sort((a, b) => (a.fecha + a.hora_inicio).localeCompare(b.fecha + b.hora_inicio));

  return (
    <div className="ax">
      <div className="ax-head">
        <div>
          <div className="ax-title">Agenda del doctor</div>
          <div className="ax-sub">
            Selecciona un día o una franja horaria para agendar una cita. {delDia.length} {delDia.length === 1 ? "cita" : "citas"} en el día seleccionado.
          </div>
        </div>
        <button type="button" className="btn-sm" onClick={() => abrirNueva()}>+ Nueva cita</button>
      </div>

      {aviso && <div className="ax-aviso">{aviso}</div>}

      <div className="ax-layout">
        <div className="ax-side">
          <MiniCalendario
            fecha={fecha}
            celdas={celdas}
            porDia={porDia}
            onDia={setFecha}
            onMes={(n) => setFecha(addMonthsIso(fecha, n))}
            onNueva={() => abrirNueva()}
            nDia={delDia.length}
          />
          <div className="ax-card ax-leg">
            <h3>Estados de cita</h3>
            <ul>
              {ESTADOS.map((e) => (
                <li key={e.v} className={"ax-st-" + e.v}>
                  <i />{e.label}
                  <b>{delDia.filter((c) => c.estado === e.v).length}</b>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="ax-main">
          <div className="ax-tb">
            <div className="ax-tb-nav">
              <button type="button" className="ax-btn" onClick={() => mover(-1)} aria-label="Anterior">‹</button>
              <button type="button" className="ax-btn" onClick={() => setFecha(hoyISO())}>Hoy</button>
              <button type="button" className="ax-btn" onClick={() => mover(1)} aria-label="Siguiente">›</button>
            </div>
            <div className="ax-tb-title">{titulo()}</div>
            <div className="ax-tb-right">
              <select className="ax-sel" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} aria-label="Filtrar por doctor">
                <option value="">Todos los doctores</option>
                {doctores.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
              <div className="ax-tabs" role="tablist">
                {[["dia", "Día"], ["semana", "Semana"], ["mes", "Mes"], ["lista", "Lista"]].map(([k, l]) => (
                  <button key={k} type="button" role="tab" aria-selected={vista === k} className={"ax-tab" + (vista === k ? " on" : "")} onClick={() => setVista(k)}>{l}</button>
                ))}
              </div>
            </div>
          </div>
          {loading && <div className="ax-loading">Cargando citas…</div>}

          {vista === "dia" && (
            <VistaDia fecha={fecha} citas={delDia} mostrarDoctor={!doctorId} onSlot={(d, t) => abrirNueva(d, t)} onOpen={setSelId} />
          )}
          {vista === "semana" && (
            <VistaSemana
              fecha={fecha}
              porDia={porDia}
              mostrarDoctor={!doctorId}
              onSlot={(d, t) => abrirNueva(d, t)}
              onOpen={setSelId}
              onDia={(d) => { setFecha(d); setVista("dia"); }}
            />
          )}
          {vista === "mes" && (
            <VistaMes
              fecha={fecha}
              celdas={celdas}
              porDia={porDia}
              onDia={(d) => { setFecha(d); setVista("dia"); }}
              onNueva={(d) => abrirNueva(d)}
              onOpen={setSelId}
            />
          )}
          {vista === "lista" && (
            <div className="ax-list">
              <div className="ax-list-bar">
                <strong style={{ fontSize: 13 }}>Citas de {MESES[parseIso(fecha).getMonth()]} {parseIso(fecha).getFullYear()}</strong>
                <select className="ax-sel" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                  <option value="">Todos los estados</option>
                  {ESTADOS.map((e) => <option key={e.v} value={e.v}>{e.label}</option>)}
                </select>
              </div>
              <table style={{ minWidth: 760 }}>
                <thead>
                  <tr><th>Paciente</th><th>Doctor</th><th>Fecha / Hora</th><th>Motivo</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {!loading && listaFiltrada.length === 0 && (
                    <tr><td colSpan={5} className="txt-muted" style={{ padding: 20 }}>Sin citas para este filtro.</td></tr>
                  )}
                  {listaFiltrada.map((c) => (
                    <tr key={c.id} onClick={() => setSelId(c.id)} style={{ cursor: "pointer" }}>
                      <td className="fw6">{nombreDe(c)}</td>
                      <td>{c.doctores?.nombre || "?"}</td>
                      <td>{fmtFecha(c.fecha)} · {hhmm(c.hora_inicio)}</td>
                      <td>{c.motivo || "—"}</td>
                      <td><span className={"tag " + estadoInfo(c.estado).tag}>{estadoInfo(c.estado).label}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {seleccionada && (
        <Detalle cita={seleccionada} onClose={() => setSelId(null)} onEstado={cambiarEstado} onEditar={abrirEditar} irA={irA} />
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
