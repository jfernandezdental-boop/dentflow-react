import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const PAV_COLORS = [
  ["#E3ECF0", "#4A6C7C"],
  ["#E3EEE8", "#3F6B55"],
  ["#ECECEA", "#5C5C5C"],
  ["#F6E7E9", "#A24655"],
  ["#F7EFDD", "#8A5E14"],
  ["#DCE8E1", "#3A5766"],
];

function getInitials(name) {
  return (name || "")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const EMPTY_FORM = {
  nombre: "",
  cedula: "",
  telefono: "",
  email: "",
  fechaNac: "",
  genero: "",
  direccion: "",
  alergias: "",
  seguro: "",
  numeroHistoria: "",
};

function PacienteModal({ open, editing, onClose, onSaved, onDesactivado, consultorioId }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? {
              nombre: editing.nombre || "",
              cedula: editing.cedula || "",
              telefono: editing.telefono || "",
              email: editing.email || "",
              fechaNac: editing.fecha_nac || "",
              genero: editing.genero || "",
              direccion: editing.direccion || "",
              alergias: editing.alergias || "",
              seguro: editing.seguro || "",
              numeroHistoria: editing.numero_historia || "",
            }
          : EMPTY_FORM
      );
      setError("");
    }
  }, [open, editing]);

  if (!open) return null;

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function guardar() {
    if (!form.nombre.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    setError("");
    const dbPayload = {
      nombre: form.nombre.trim(),
      cedula: form.cedula || null,
      telefono: form.telefono || null,
      email: form.email || null,
      fecha_nac: form.fechaNac || null,
      genero: form.genero || null,
      direccion: form.direccion || null,
      alergias: form.alergias || null,
      seguro: form.seguro || null,
      numero_historia: form.numeroHistoria || null,
    };

    let res;
    if (editing) {
      res = await supabase.from("pacientes").update(dbPayload).eq("id", editing.id);
    } else {
      dbPayload.consultorio_id = consultorioId;
      dbPayload.activo = true;
      res = await supabase.from("pacientes").insert(dbPayload);
    }
    setSaving(false);
    if (res.error) {
      setError(editing ? "No se pudo guardar: " + res.error.message : "No se pudo crear el paciente: " + res.error.message);
      return;
    }
    onSaved();
  }

  async function desactivar() {
    if (!editing) return;
    if (!window.confirm("¿Desactivar este paciente? Su historial clínico, citas y presupuestos se conservan; solo dejará de aparecer en la lista activa.")) return;
    setSaving(true);
    const { error: err } = await supabase.from("pacientes").update({ activo: false }).eq("id", editing.id);
    setSaving(false);
    if (err) {
      setError("No se pudo desactivar: " + err.message);
      return;
    }
    onDesactivado();
  }

  return (
    <div className="appt-modal on">
      <div className="appt-box" style={{ width: 520, maxHeight: "90vh", overflowY: "auto" }}>
        <div className="appt-box-title">{editing ? "✏️ Editar paciente" : "👤 Nuevo paciente"}</div>
        <div className="appt-box-sub">Completa los datos del paciente</div>

        {editing && (
          <div className="appt-modal-edit-bar" style={{ display: "flex" }}>
            <div className="appt-edit-badge">✏️ Editando paciente</div>
            <button className="btn-delete-appt" onClick={desactivar} disabled={saving} type="button">
              🗑 Desactivar
            </button>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div className="fl" style={{ margin: 0 }}>
            <label>Nombre completo</label>
            <input className="fi sm" placeholder="Nombre y apellido" value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
          </div>
          <div className="fl" style={{ margin: 0 }}>
            <label>Cédula / ID</label>
            <input className="fi sm" placeholder="0912345678" value={form.cedula} onChange={(e) => set("cedula", e.target.value)} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div className="fl" style={{ margin: 0 }}>
            <label>Teléfono</label>
            <input className="fi sm" placeholder="+593 99 000 0000" value={form.telefono} onChange={(e) => set("telefono", e.target.value)} />
          </div>
          <div className="fl" style={{ margin: 0 }}>
            <label>Email</label>
            <input className="fi sm" type="email" placeholder="paciente@email.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div className="fl" style={{ margin: 0 }}>
            <label>Fecha de nacimiento</label>
            <input className="fi sm" type="date" value={form.fechaNac} onChange={(e) => set("fechaNac", e.target.value)} />
          </div>
          <div className="fl" style={{ margin: 0 }}>
            <label>Género</label>
            <select className="fi sm" value={form.genero} onChange={(e) => set("genero", e.target.value)}>
              <option value="">—</option>
              <option value="F">Femenino</option>
              <option value="M">Masculino</option>
              <option value="otro">Otro</option>
            </select>
          </div>
        </div>

        <div className="fl" style={{ marginBottom: 12 }}>
          <label>Dirección</label>
          <input className="fi sm" placeholder="Dirección" value={form.direccion} onChange={(e) => set("direccion", e.target.value)} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div className="fl" style={{ margin: 0 }}>
            <label>Alergias</label>
            <input className="fi sm" placeholder="Ninguna conocida" value={form.alergias} onChange={(e) => set("alergias", e.target.value)} />
          </div>
          <div className="fl" style={{ margin: 0 }}>
            <label>Seguro médico</label>
            <input className="fi sm" placeholder="Opcional" value={form.seguro} onChange={(e) => set("seguro", e.target.value)} />
          </div>
        </div>

        <div className="fl" style={{ marginBottom: 12 }}>
          <label>N° de historia clínica</label>
          <input className="fi sm" placeholder="Opcional" value={form.numeroHistoria} onChange={(e) => set("numeroHistoria", e.target.value)} />
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
            {saving ? "Guardando…" : editing ? "💾 Guardar cambios" : "💾 Guardar paciente"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Pacientes() {
  const { profile } = useAuth();
  const consultorioId = profile?.consultorio_id || null;
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  async function cargar() {
    if (!consultorioId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from("pacientes").select("*").eq("consultorio_id", consultorioId).eq("activo", true).order("nombre");
    if (!error) setPacientes(data || []);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultorioId]);

  const filtrados = useMemo(() => {
    if (!q) return pacientes;
    const ql = q.toLowerCase();
    return pacientes.filter(
      (p) => (p.nombre || "").toLowerCase().includes(ql) || (p.cedula || "").includes(ql) || (p.telefono || "").includes(ql)
    );
  }, [pacientes, q]);

  function abrirNuevo() {
    setEditing(null);
    setModalOpen(true);
  }
  function abrirEditar(p) {
    setEditing(p);
    setModalOpen(true);
  }
  function cerrarModal() {
    setModalOpen(false);
    setEditing(null);
  }
  async function alGuardar() {
    cerrarModal();
    await cargar();
  }
  async function alDesactivar() {
    cerrarModal();
    await cargar();
  }

  return (
    <div style={{ padding: 28 }}>
      <div className="srow">
        <input className="si" placeholder="🔍  Buscar por nombre, cédula o teléfono…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-sm" onClick={abrirNuevo}>
          + Nuevo paciente
        </button>
      </div>

      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Cédula/ID</th>
              <th>Teléfono</th>
              <th>Email</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="txt-muted" style={{ padding: 20 }}>
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && filtrados.length === 0 && (
              <tr>
                <td colSpan={5} className="txt-muted" style={{ padding: 20 }}>
                  {q ? "Sin resultados para esa búsqueda." : "Todavía no hay pacientes registrados."}
                </td>
              </tr>
            )}
            {!loading &&
              filtrados.map((p, i) => {
                const [bg, fg] = PAV_COLORS[i % PAV_COLORS.length];
                return (
                  <tr key={p.id} onDoubleClick={() => abrirEditar(p)} style={{ cursor: "pointer" }} title="Doble clic para editar">
                    <td>
                      <div className="flex gap8 items-c">
                        <div className="ai-av" style={{ background: bg, color: fg, width: 30, height: 30, fontSize: 11 }}>
                          {getInitials(p.nombre)}
                        </div>
                        <div>
                          <div className="fw6">{p.nombre}</div>
                          <div className="txt-muted">{p.email || "—"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {p.cedula || "—"}
                    </td>
                    <td>{p.telefono || "—"}</td>
                    <td>{p.email || "—"}</td>
                    <td>
                      <span className="tl" onClick={() => abrirEditar(p)}>
                        Editar →
                      </span>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <PacienteModal
        open={modalOpen}
        editing={editing}
        consultorioId={consultorioId}
        onClose={cerrarModal}
        onSaved={alGuardar}
        onDesactivado={alDesactivar}
      />
    </div>
  );
}
