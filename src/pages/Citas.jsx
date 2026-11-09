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
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [duracion, setDuracion] = useState(30);
  const [motivo, setMotivo] = useState("");
  const [notas, setNotas] = useState("");
  const [estado, setEstado] = useState("pendiente");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setPacienteId(editing.paciente_id || "");
      setDoctorId(editing.doctor_id || "");
      setFecha(editing.fecha || "");
      setHoraInicio((editing.hora_inicio || "09:00").slice(0, 5));
      const d = timeToMin(editing.hora_fin) - timeToMin(editing.hora_inicio);
      setDuracion(d > 0 ? d : 30);
      setMotivo(editing.motivo || "");
      setNotas(editing.notas || "");
      setEstado(editing.estado || "pendiente");
    } else {
      setPacienteId("");
      setDoctorId("");
      setFecha(defaultDate || hoyISO());
      setHoraInicio(defaultHora || "09:00");
      setDuracion(30);
      setMotivo("");
      setNotas("");
      setEstado("pendiente");
    }
    setErr("");
  }, [open, editing, defaultDate, defaultHora]);

  if (!open) return null;

  const horaFin = minToTime(timeToMin(horaInicio) + Number(duracion));

  const guardar = async (e) => {
    e.preventDefault();
    if (!pacienteId || !doctorId || !fecha || !horaInicio) {
      setErr("Completa paciente, doctor, fecha y hora.");
      return;
    }
    setSaving(true);
    setErr("");
    const payload = {
      paciente_id: pacienteId,
      doctor_id: doctorId,
      consultorio_id: consultorioId,
      fecha,
      hora_inicio: horaInicio.length === 5 ? horaInicio + ":00" : horaInicio,
      hora_fin: horaFin.length === 5 ? horaFin + ":00" : horaFin,
      motivo: motivo || null,
      notas: notas || null,
      estado,
    };
    let error;
    if (editing?.id) {
      ({ error } = await supabase.from("citas").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("citas").insert(payload));
    }
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onSaved();
  };

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-h">
          <div className="modal-t">{editing ? "Editar cita" : "Nueva cita"}</div>
          <button type="button" className="modal-x" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={guardar}>
          <div className="modal-b" style={{ display: "grid", gap: 12 }}>
            {err && <div className="ax-aviso">{err}</div>}
            <div>
              <label className="lbl">Paciente *</label>
              <select className="fi" value={pacienteId} onChange={(e) => setPacienteId(e.target.value)} required>
                <option value="">Selecciona…</option>
                {pacientes.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="lbl">Odontólogo *</label>
              <select className="fi" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} required>
                <option value="">Selecciona…</option>
                {doctores.map((d) => (
                  <option key={d.id} value={d.id}>{d.nombre}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <label className="lbl">Fecha *</label>
                <input type="date" className="fi" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
              </div>
              <div>
                <label className="lbl">Hora *</label>
                <input type="time" className="fi" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} required />
              </div>
              <div>
                <label className="lbl">Duración</label>
                <select className="fi" value={duracion} onChange={(e) => setDuracion(Number(e.target.value))}>
                  {DURACIONES.map((m) => <option key={m} value={m}>{m} min</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="lbl">Motivo</label>
              <input className="fi" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Consulta, control…" />
            </div>
            <div>
              <label className="lbl">Notas</label>
              <textarea className="fi" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
            </div>
            <div>
              <label className="lbl">Estado</label>
              <select className="fi" value={estado} onChange={(e) => setEstado(e.target.value)}>
                {ESTADOS.map((e) => <option key={e.v} value={e.v}>{e.label}</option>)}
              </select>
            </div>
          </div>
          <div className="modal-f">
            <button type="button" className="btn-sm sec" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-sm" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
