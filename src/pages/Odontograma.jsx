import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const RED = "#dc2626";
const BLUE = "#2563eb";
const NAVY = "#1e3a5f";

const TOOLS = [
  { id: "caries", label: "Caries (relleno rojo)", kind: "face", color: "red", symbol: null, previewColor: RED },
  { id: "obturado", label: "Obturado (relleno azul)", kind: "face", color: "blue", symbol: null, previewColor: BLUE },
  { id: "sellante-nec", label: "Sellante necesario", kind: "whole", symbol: "sellante-nec", previewColor: RED },
  { id: "sellante-real", label: "Sellante realizado", kind: "whole", symbol: "sellante-real", previewColor: BLUE },
  { id: "ext-ind", label: "Extracción indicada", kind: "whole", symbol: "ext-ind", previewColor: RED },
  { id: "perdida-caries", label: "Pérdida por caries", kind: "whole", symbol: "perdida-caries", previewColor: BLUE },
  { id: "perdida-otra", label: "Pérdida (otra causa)", kind: "whole", symbol: "perdida-otra", previewColor: NAVY },
  { id: "endo-realizar", label: "Endodoncia por realizar", kind: "whole", symbol: "endo-realizar", previewColor: RED },
  { id: "endo-realizada", label: "Endodoncia realizada", kind: "whole", symbol: "endo-realizada", previewColor: NAVY },
  { id: "fija-ind", label: "Prótesis fija indicada", kind: "whole", symbol: "fija-ind", previewColor: RED },
  { id: "fija-real", label: "Prótesis fija realizada", kind: "whole", symbol: "fija-real", previewColor: NAVY },
  { id: "removible-ind", label: "Prótesis removible indicada", kind: "whole", symbol: "removible-ind", previewColor: RED },
  { id: "removible-real", label: "Prótesis removible realizada", kind: "whole", symbol: "removible-real", previewColor: NAVY },
  { id: "total-ind", label: "Prótesis total indicada", kind: "whole", symbol: "total-ind", previewColor: RED },
  { id: "total-real", label: "Prótesis total realizada", kind: "whole", symbol: "total-real", previewColor: NAVY },
  { id: "corona-ind", label: "Corona indicada", kind: "whole", symbol: "corona-ind", previewColor: RED },
  { id: "corona-real", label: "Corona realizada", kind: "whole", symbol: "corona-real", previewColor: NAVY },
  { id: "ausente", label: "Ausente", kind: "whole", symbol: "ausente", previewColor: "#111" },
  { id: "clear", label: "Borrar", kind: "clear", symbol: null, previewColor: "#fff" },
];

const QUADRANTS = {
  perm_upper: [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
  temp_upper: [55, 54, 53, 52, 51, 61, 62, 63, 64, 65],
  temp_lower: [85, 84, 83, 82, 81, 71, 72, 73, 74, 75],
  perm_lower: [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
};
const ALL_TEETH = [...QUADRANTS.perm_upper, ...QUADRANTS.temp_upper, ...QUADRANTS.temp_lower, ...QUADRANTS.perm_lower];

function emptyMark() { return { color: null, symbol: null }; }
function emptyTooth() { return { top: emptyMark(), right: emptyMark(), bottom: emptyMark(), left: emptyMark(), center: emptyMark(), whole: null, mov: "", rec: "" }; }
function toothIsEmpty(t) {
  const facesEmpty = ["top", "right", "bottom", "left", "center"].every((f) => !t[f].color && !t[f].symbol);
  return facesEmpty && !t.whole && !t.mov && !t.rec;
}
function faceFill(m) { return m.color === "red" ? RED : m.color === "blue" ? BLUE : "transparent"; }
function denticionDePieza(n) {
  return QUADRANTS.temp_upper.includes(n) || QUADRANTS.temp_lower.includes(n) ? "temporal" : "permanente";
}

/** Misma geometría que el original: cada símbolo se dibuja dentro de un cuadro 0..s. */
function iconMarkup(symbol, s) {
  const mid = s / 2;
  switch (symbol) {
    case "sellante-nec":
      return `<rect x="${mid - s * 0.1}" y="${s * 0.14}" width="${s * 0.2}" height="${s * 0.72}" rx="${s * 0.06}" fill="none" stroke="${RED}" stroke-width="${Math.max(1.4, s * 0.06)}"/>`;
    case "sellante-real":
      return `<rect x="${mid - s * 0.1}" y="${s * 0.14}" width="${s * 0.2}" height="${s * 0.72}" rx="${s * 0.06}" fill="none" stroke="${BLUE}" stroke-width="${Math.max(1.4, s * 0.06)}"/>`;
    case "perdida-otra":
      return `<rect x="${mid - s * 0.11}" y="${s * 0.12}" width="${s * 0.22}" height="${s * 0.76}" rx="${s * 0.06}" fill="none" stroke="${NAVY}" stroke-width="${Math.max(1.6, s * 0.07)}"/>`;
    case "ext-ind":
      return `<g stroke="${RED}" stroke-width="${Math.max(1.8, s * 0.1)}" stroke-linecap="round"><line x1="${s * 0.18}" y1="${s * 0.18}" x2="${s * 0.82}" y2="${s * 0.82}"/><line x1="${s * 0.82}" y1="${s * 0.18}" x2="${s * 0.18}" y2="${s * 0.82}"/></g>`;
    case "perdida-caries":
      return `<g stroke="${BLUE}" stroke-width="${Math.max(1.8, s * 0.1)}" stroke-linecap="round"><line x1="${s * 0.18}" y1="${s * 0.18}" x2="${s * 0.82}" y2="${s * 0.82}"/><line x1="${s * 0.82}" y1="${s * 0.18}" x2="${s * 0.18}" y2="${s * 0.82}"/></g>`;
    case "endo-realizar":
      return `<polygon points="${mid},${s * 0.14} ${s * 0.13},${s * 0.85} ${s * 0.87},${s * 0.85}" fill="none" stroke="${RED}" stroke-width="${Math.max(1.4, s * 0.06)}"/>`;
    case "endo-realizada":
      return `<polygon points="${mid},${s * 0.14} ${s * 0.13},${s * 0.85} ${s * 0.87},${s * 0.85}" fill="#dbeafe" stroke="${NAVY}" stroke-width="${Math.max(1.4, s * 0.06)}"/>`;
    case "total-ind":
      return `<g stroke="${RED}" stroke-width="${Math.max(1.5, s * 0.075)}"><line x1="${s * 0.1}" y1="${mid - s * 0.08}" x2="${s * 0.9}" y2="${mid - s * 0.08}"/><line x1="${s * 0.1}" y1="${mid + s * 0.08}" x2="${s * 0.9}" y2="${mid + s * 0.08}"/></g>`;
    case "total-real":
      return `<g stroke="${NAVY}" stroke-width="${Math.max(1.5, s * 0.075)}"><line x1="${s * 0.1}" y1="${mid - s * 0.08}" x2="${s * 0.9}" y2="${mid - s * 0.08}"/><line x1="${s * 0.1}" y1="${mid + s * 0.08}" x2="${s * 0.9}" y2="${mid + s * 0.08}"/></g>`;
    case "corona-ind":
      return `<circle cx="${mid}" cy="${mid}" r="${s * 0.16}" fill="${RED}"/>`;
    case "corona-real":
      return `<circle cx="${mid}" cy="${mid}" r="${s * 0.16}" fill="${NAVY}"/>`;
    case "fija-ind":
      return `<g stroke="${RED}" stroke-width="${Math.max(1.2, s * 0.045)}" fill="none"><rect x="${s * 0.05}" y="${mid - s * 0.09}" width="${s * 0.18}" height="${s * 0.18}"/><rect x="${s * 0.77}" y="${mid - s * 0.09}" width="${s * 0.18}" height="${s * 0.18}"/><line x1="${s * 0.25}" y1="${mid}" x2="${s * 0.75}" y2="${mid}" stroke-dasharray="${Math.max(1, s * 0.05)},${Math.max(1, s * 0.045)}"/></g>`;
    case "fija-real":
      return `<g stroke="${NAVY}" stroke-width="${Math.max(1.2, s * 0.045)}" fill="none"><rect x="${s * 0.05}" y="${mid - s * 0.09}" width="${s * 0.18}" height="${s * 0.18}"/><rect x="${s * 0.77}" y="${mid - s * 0.09}" width="${s * 0.18}" height="${s * 0.18}"/><line x1="${s * 0.25}" y1="${mid}" x2="${s * 0.75}" y2="${mid}" stroke-dasharray="${Math.max(1, s * 0.05)},${Math.max(1, s * 0.045)}"/></g>`;
    case "removible-ind":
      return `<text x="${mid}" y="${mid + s * 0.16}" text-anchor="middle" font-size="${s * 0.42}" font-family="monospace" font-weight="700" fill="${RED}">(----)</text>`;
    case "removible-real":
      return `<text x="${mid}" y="${mid + s * 0.16}" text-anchor="middle" font-size="${s * 0.42}" font-family="monospace" font-weight="700" fill="${NAVY}">(----)</text>`;
    case "ausente":
      return `<text x="${mid}" y="${mid + s * 0.2}" text-anchor="middle" font-size="${s * 0.66}" font-weight="700" fill="#111">A</text>`;
    default:
      return "";
  }
}

function toolPreviewSvg(t) {
  const s = 16;
  if (t.kind === "clear") return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><g stroke="#dc2626" stroke-width="2" stroke-linecap="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></g></svg>`;
  if (t.kind === "face") return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><rect x="1" y="1" width="${s - 2}" height="${s - 2}" rx="2" fill="${t.previewColor}" stroke="#94a3b8"/></svg>`;
  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">${iconMarkup(t.symbol, s)}</svg>`;
}

/** Un diente: cuadrado partido en 5 caras clicables (sobre/der/bajo/izq/centro) + símbolo entero encima. */
function Tooth({ n, tooth, size, onFace }) {
  const s = size, c = s / 3;
  return (
    <div className="tooth">
      <div className="tooth-num">{n}</div>
      <div>
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className="tooth-svg">
          <polygon points={`0,0 ${s},0 ${s - c},${c} ${c},${c}`} fill={faceFill(tooth.top)} stroke="#64748b" onClick={() => onFace(n, "top")} />
          <polygon points={`${s},0 ${s},${s} ${s - c},${s - c} ${s - c},${c}`} fill={faceFill(tooth.right)} stroke="#64748b" onClick={() => onFace(n, "right")} />
          <polygon points={`${s},${s} 0,${s} ${c},${s - c} ${s - c},${s - c}`} fill={faceFill(tooth.bottom)} stroke="#64748b" onClick={() => onFace(n, "bottom")} />
          <polygon points={`0,0 0,${s} ${c},${s - c} ${c},${c}`} fill={faceFill(tooth.left)} stroke="#64748b" onClick={() => onFace(n, "left")} />
          <rect className="face" x={c} y={c} width={s - 2 * c} height={s - 2 * c} fill={faceFill(tooth.center)} stroke="#64748b" onClick={() => onFace(n, "center")} />
          {tooth.whole && <g style={{ pointerEvents: "none" }} dangerouslySetInnerHTML={{ __html: iconMarkup(tooth.whole, s) }} />}
        </svg>
      </div>
    </div>
  );
}

function ToothStrip({ list, size, pad, teeth, onFace }) {
  const mid = Math.floor(list.length / 2);
  const left = list.slice(0, mid), right = list.slice(mid);
  return (
    <div className="tooth-strip" style={pad ? { paddingLeft: size * 3, paddingRight: size * 3 } : undefined}>
      <div className="side">{left.map((n) => <Tooth key={n} n={n} tooth={teeth[n]} size={size} onFace={onFace} />)}</div>
      <div style={{ width: size / 2, flexShrink: 0 }} />
      <div className="side">{right.map((n) => <Tooth key={n} n={n} tooth={teeth[n]} size={size} onFace={onFace} />)}</div>
    </div>
  );
}

function OdontoRow({ label, list, field, teeth, onChange }) {
  const mid = Math.floor(list.length / 2);
  const left = list.slice(0, mid), right = list.slice(mid);
  const cell = (n) => (
    <input
      key={n}
      maxLength={1}
      className="mv-input"
      value={teeth[n][field] || ""}
      onChange={(e) => onChange(n, field, e.target.value.replace(/[^1-4]/g, ""))}
    />
  );
  return (
    <div className="odonto-row">
      <div className="row-label">{label}</div>
      <div className="side">{left.map(cell)}</div>
      <div className="gap" />
      <div className="side">{right.map(cell)}</div>
    </div>
  );
}

const LEGEND_WHOLE = [
  ["ext-ind", "Extracción indicada"], ["sellante-nec", "Sellante necesario"], ["endo-realizar", "Endodoncia por realizar"],
  ["fija-ind", "Prótesis fija indicada"], ["removible-ind", "Prótesis removible indicada"], ["total-ind", "Prótesis total indicada"],
  ["corona-ind", "Corona indicada"], ["perdida-caries", "Pérdida por caries"], ["sellante-real", "Sellante realizado"],
  ["endo-realizada", "Endodoncia realizada"], ["fija-real", "Prótesis fija realizada"], ["removible-real", "Prótesis removible realizada"],
  ["total-real", "Prótesis total realizada"], ["corona-real", "Corona realizada"], ["perdida-otra", "Pérdida (otra causa)"], ["ausente", "Ausente"],
];

export default function Odontograma() {
  const { profile } = useAuth();
  const consultorioId = profile?.consultorio_id || null;

  const [pacientes, setPacientes] = useState([]);
  const [pacienteId, setPacienteId] = useState("");
  const [paciente, setPaciente] = useState(null);
  const [revisiones, setRevisiones] = useState([]); // atenciones_odontologicas de este paciente, desc por fecha
  const [revisionActualId, setRevisionActualId] = useState(""); // "" = nueva revisión (en edición)
  const [teeth, setTeeth] = useState(() => Object.fromEntries(ALL_TEETH.map((n) => [n, emptyTooth()])));
  const [toolId, setToolId] = useState(TOOLS[0].id);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  // Historial clínico concatenado del paciente: recetario (tabla recetas,
  // filtrado por la misma fecha que la revisión abierta, ya que "recetas"
  // no tiene atencion_id — solo paciente_id + fecha) + diagnóstico/
  // tratamiento de la atención que se está viendo (atencion_diagnosticos/
  // atencion_tratamientos, esos sí atados por atencion_id real).
  const [recetasPaciente, setRecetasPaciente] = useState([]);
  const [detalleAtencion, setDetalleAtencion] = useState(null); // { diagnosticos:[], tratamientos:[] } | null
  const currentTool = TOOLS.find((t) => t.id === toolId) || TOOLS[0];
  const cargaEnCurso = useRef(0);
  const soloLectura = revisionActualId !== "" && revisionActualId !== "nueva";

  async function cargarSnapshot(pid, atencionId) {
    let query = supabase.from("odontograma_registros").select("pieza,denticion,caras,simbolo_completo,movilidad,recesion").eq("paciente_id", pid);
    query = atencionId ? query.eq("atencion_id", atencionId) : query.is("atencion_id", null);
    const { data, error } = await query;
    if (error) return { error };
    const nuevo = Object.fromEntries(ALL_TEETH.map((n) => [n, emptyTooth()]));
    (data || []).forEach((row) => {
      const n = row.pieza;
      if (!ALL_TEETH.includes(n)) return;
      const caras = row.caras || {};
      nuevo[n] = {
        top: caras.top || emptyMark(), right: caras.right || emptyMark(), bottom: caras.bottom || emptyMark(),
        left: caras.left || emptyMark(), center: caras.center || emptyMark(),
        whole: row.simbolo_completo || null, mov: row.movilidad || "", rec: row.recesion || "",
      };
    });
    return { teeth: nuevo };
  }

  /** Diagnóstico + tratamiento (secciones del HCU-033) de una atención puntual. */
  async function cargarDetalleAtencion(atencionId) {
    if (!atencionId) { setDetalleAtencion(null); return; }
    const [{ data: diags }, { data: trats }] = await Promise.all([
      supabase.from("atencion_diagnosticos").select("codigo_cie10,descripcion,pieza").eq("atencion_id", atencionId).order("orden"),
      supabase.from("atencion_tratamientos").select("numero_sesion,procedimientos,prescripciones").eq("atencion_id", atencionId).order("orden"),
    ]);
    setDetalleAtencion({ diagnosticos: diags || [], tratamientos: trats || [] });
  }

  function fechaISOHoy() {
    return new Date().toISOString().slice(0, 10);
  }

  /** Recetas del paciente emitidas la MISMA fecha que la revisión abierta — es
   * el único cruce posible, ya que "recetas" no tiene atencion_id propio. */
  async function cargarRecetasDeFecha(pid, fecha) {
    if (!pid || !fecha) { setRecetasPaciente([]); return; }
    const { data } = await supabase
      .from("recetas")
      .select("id,fecha,diagnostico_desc,receta_medicamentos(nombre_generico)")
      .eq("paciente_id", pid)
      .eq("fecha", fecha);
    setRecetasPaciente(data || []);
  }

  useEffect(() => {
    (async () => {
      if (!consultorioId) return;
      const { data } = await supabase.from("pacientes").select("id,nombre,cedula,numero_historia,doctor_id").eq("consultorio_id", consultorioId).eq("activo", true).order("nombre");
      setPacientes(data || []);
    })();
  }, [consultorioId]);

  useEffect(() => {
    const miCarga = ++cargaEnCurso.current;
    if (!pacienteId) {
      setPaciente(null);
      setRevisiones([]);
      setRevisionActualId("");
      setTeeth(Object.fromEntries(ALL_TEETH.map((n) => [n, emptyTooth()])));
      setRecetasPaciente([]);
      setDetalleAtencion(null);
      return;
    }
    const p = pacientes.find((x) => x.id === pacienteId) || null;
    setPaciente(p);
    setLoading(true);
    setMsg("");
    (async () => {
      // Piezas/revisiones del paciente (ya existía). El recetario se pide
      // después, filtrado por la fecha de la revisión que queda abierta —
      // así al elegir un paciente se ve todo concatenado (odontograma +
      // diagnóstico/tratamiento + recetas de esa misma fecha), no solo el
      // odontograma.
      const { data: atenciones } = await supabase
        .from("atenciones_odontologicas")
        .select("id,fecha,hora,motivo_consulta")
        .eq("paciente_id", pacienteId)
        .order("fecha", { ascending: false })
        .order("hora", { ascending: false });
      if (cargaEnCurso.current !== miCarga) return;
      const lista = atenciones || [];
      setRevisiones(lista);

      // Punto de partida editable: la revisión más reciente si existe, si no
      // el registro heredado (atencion_id null) de antes de este cambio.
      const masReciente = lista[0]?.id || null;
      const fechaAbierta = lista[0]?.fecha || fechaISOHoy();
      const [{ teeth: cargados, error }] = await Promise.all([
        cargarSnapshot(pacienteId, masReciente),
        cargarDetalleAtencion(masReciente),
        cargarRecetasDeFecha(pacienteId, fechaAbierta),
      ]);
      if (cargaEnCurso.current !== miCarga) return;
      if (error) { setMsg("No se pudo cargar el odontograma: " + error.message); setLoading(false); return; }
      setTeeth(cargados);
      setRevisionActualId("nueva"); // se edita siempre como continuación; al guardar se crea una revisión nueva
      setLoading(false);
    })();
  }, [pacienteId, pacientes]);

  async function verRevision(atencionId) {
    if (!pacienteId) return;
    setLoading(true);
    setMsg("");
    // Registros heredados (atencion_id null, de antes de este cambio) no
    // tienen fecha propia con la que cruzar recetas — en ese caso se
    // muestra el recetario vacío en vez de adivinar.
    const fechaAbierta = atencionId ? (revisiones.find((r) => r.id === atencionId)?.fecha || null) : null;
    const [{ teeth: cargados, error }] = await Promise.all([
      cargarSnapshot(pacienteId, atencionId || null),
      cargarDetalleAtencion(atencionId || null),
      cargarRecetasDeFecha(pacienteId, fechaAbierta),
    ]);
    if (error) { setMsg("No se pudo cargar esa revisión: " + error.message); setLoading(false); return; }
    setTeeth(cargados);
    setRevisionActualId(atencionId || "legado");
    setLoading(false);
  }

  async function continuarDesdeAqui() {
    setRevisionActualId("nueva");
    setMsg("Editando una revisión nueva a partir de lo que ves — al guardar queda con la fecha y hora de hoy.");
  }

  function handleFace(n, face) {
    if (soloLectura) return;
    setTeeth((prev) => {
      const t = prev[n];
      let nt = t;
      if (currentTool.kind === "clear") {
        nt = face === "center" && t.whole ? { ...t, whole: null } : { ...t, [face]: emptyMark() };
      } else if (currentTool.kind === "whole" && currentTool.symbol) {
        nt = { ...t, whole: currentTool.symbol };
      } else if (currentTool.kind === "face" && currentTool.color) {
        nt = { ...t, [face]: { color: currentTool.color, symbol: null } };
      }
      return { ...prev, [n]: nt };
    });
  }
  function handleMovRec(n, field, value) {
    if (soloLectura) return;
    setTeeth((prev) => ({ ...prev, [n]: { ...prev[n], [field]: value } }));
  }

  function limpiarTodo() {
    if (!window.confirm("¿Borrar todo el odontograma de este paciente en pantalla? (no se guarda hasta que presiones Guardar)")) return;
    setTeeth(Object.fromEntries(ALL_TEETH.map((n) => [n, emptyTooth()])));
  }

  async function guardar() {
    if (!pacienteId) { setMsg("Selecciona un paciente primero."); return; }
    setSaving(true);
    setMsg("");

    const ahora = new Date();
    const { data: atencion, error: atErr } = await supabase
      .from("atenciones_odontologicas")
      .insert({
        paciente_id: pacienteId,
        doctor_id: paciente?.doctor_id || null,
        fecha: ahora.toISOString().slice(0, 10),
        hora: ahora.toTimeString().slice(0, 8),
        motivo_consulta: "Actualización de odontograma",
        creado_por: profile?.id || null,
      })
      .select("id,fecha,hora,motivo_consulta")
      .single();
    if (atErr) { setSaving(false); setMsg("No se pudo crear el registro de esta revisión: " + atErr.message); return; }

    const rows = ALL_TEETH.filter((n) => !toothIsEmpty(teeth[n])).map((n) => ({
      paciente_id: pacienteId,
      atencion_id: atencion.id,
      pieza: n,
      denticion: denticionDePieza(n),
      caras: { top: teeth[n].top, right: teeth[n].right, bottom: teeth[n].bottom, left: teeth[n].left, center: teeth[n].center },
      simbolo_completo: teeth[n].whole || null,
      movilidad: teeth[n].mov || null,
      recesion: teeth[n].rec || null,
      doctor_id: paciente?.doctor_id || null,
    }));
    if (rows.length) {
      const { error: insErr } = await supabase.from("odontograma_registros").insert(rows);
      if (insErr) { setSaving(false); setMsg("La revisión se creó pero no se pudieron guardar las piezas: " + insErr.message); return; }
    }

    setSaving(false);
    setMsg(`✓ Guardado como revisión nueva del ${atencion.fecha} ${atencion.hora?.slice(0, 5)}.`);
    setRevisiones((prev) => [atencion, ...prev]);
    setRevisionActualId(atencion.id);
  }

  const pacientesFiltrados = useMemo(() => pacientes, [pacientes]);

  return (
    <div style={{ padding: 28 }}>
      <div className="od-patient-bar">
        <div className="od-patient-info">
          <div className="od-patient-row"><span className="od-patient-label">Paciente:</span><span>{paciente?.nombre || "—"}</span></div>
          <div className="od-patient-row"><span className="od-patient-label">N.º Historia Clínica:</span><span>{paciente?.numero_historia || "—"}</span></div>
          <div className="od-patient-row"><span className="od-patient-label">Cédula:</span><span>{paciente?.cedula || "—"}</span></div>
        </div>
        <div className="flex gap8" style={{ flexWrap: "wrap" }}>
          <select className="fi sm" style={{ minWidth: 200 }} value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}>
            <option value="">Selecciona un paciente…</option>
            {pacientesFiltrados.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          {pacienteId && (
            <select
              className="fi sm"
              style={{ minWidth: 220 }}
              value={revisionActualId === "nueva" ? "" : revisionActualId}
              onChange={(e) => (e.target.value ? verRevision(e.target.value) : continuarDesdeAqui())}
            >
              <option value="">📝 Revisión de hoy (en edición)</option>
              {revisiones.map((r) => (
                <option key={r.id} value={r.id}>🕓 {r.fecha} {r.hora?.slice(0, 5)} — {r.motivo_consulta || "Revisión"}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {pacienteId && (recetasPaciente.length > 0 || (detalleAtencion && (detalleAtencion.diagnosticos.length > 0 || detalleAtencion.tratamientos.length > 0))) && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-b" style={{ padding: 16 }}>
            <div className="txt-sm" style={{ fontWeight: 700, marginBottom: 8 }}>📋 Historial clínico del paciente</div>

            {detalleAtencion && (detalleAtencion.diagnosticos.length > 0 || detalleAtencion.tratamientos.length > 0) && (
              <div style={{ marginBottom: recetasPaciente.length ? 14 : 0 }}>
                <div className="txt-sm txt-muted" style={{ marginBottom: 4 }}>
                  🩺 Diagnóstico y tratamiento de {soloLectura ? "esta revisión" : "la última visita"}
                </div>
                {detalleAtencion.diagnosticos.map((d, i) => (
                  <div key={"dx" + i} className="txt-sm" style={{ marginBottom: 2 }}>
                    <span className="tag" style={{ marginRight: 6 }}>{d.codigo_cie10 || "—"}</span>
                    {d.descripcion}{d.pieza ? ` (pieza ${d.pieza})` : ""}
                  </div>
                ))}
                {detalleAtencion.tratamientos.map((t, i) => (
                  <div key={"tx" + i} className="txt-sm txt-muted" style={{ marginBottom: 2 }}>
                    {t.procedimientos}{t.prescripciones ? ` — Rx: ${t.prescripciones}` : ""}
                  </div>
                ))}
              </div>
            )}

            {recetasPaciente.length > 0 && (
              <div>
                <div className="txt-sm txt-muted" style={{ marginBottom: 4 }}>💊 Recetario de esta fecha ({recetasPaciente.length})</div>
                {recetasPaciente.map((r) => (
                  <div key={r.id} className="txt-sm" style={{ marginBottom: 4 }}>
                    <b>{r.fecha}</b>{r.diagnostico_desc ? ` · ${r.diagnostico_desc}` : ""} — {(r.receta_medicamentos || []).map((m) => m.nombre_generico).join(", ") || "sin medicamentos"}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {soloLectura && (
        <div className="card" style={{ marginBottom: 12, background: "var(--gold-pale)", border: "1px solid var(--gold)" }}>
          <div className="card-b flex items-c jc-b" style={{ padding: "10px 16px" }}>
            <span className="txt-sm">👁️ Viendo una revisión anterior, guardada el {revisiones.find((r) => r.id === revisionActualId)?.fecha} — no se puede editar.</span>
            <button className="btn-sm sec" type="button" onClick={continuarDesdeAqui}>Continuar desde aquí →</button>
          </div>
        </div>
      )}

      <section className="section">
        <h2>H. Odontograma</h2>
        <div className="body">
          <div className="h-toolbar">
            <div className="toolbar-title">Herramienta odontograma:</div>
            <div id="toolButtons" style={{ display: "flex", flexWrap: "wrap", gap: 6, opacity: soloLectura ? 0.5 : 1, pointerEvents: soloLectura ? "none" : "auto" }}>
              {TOOLS.map((t) => (
                <button key={t.id} type="button" className={"tool-btn" + (t.id === toolId ? " od-active" : "")} title={t.label} onClick={() => setToolId(t.id)}>
                  <span className="swatch-icon" dangerouslySetInnerHTML={{ __html: toolPreviewSvg(t) }} />
                  {t.label}
                </button>
              ))}
            </div>
            <div className="spacer" style={{ flex: 1 }} />
            <button className="btn btn-danger" type="button" onClick={limpiarTodo} disabled={soloLectura}>Limpiar odontograma</button>
            <button className="btn" type="button" onClick={() => window.print()}>Imprimir / PDF</button>
            <button className="btn btn-success" type="button" onClick={guardar} disabled={saving || !pacienteId || soloLectura}>
              {saving ? "Guardando…" : "Guardar como nueva revisión"}
            </button>
          </div>


          <div className="odonto-hint">
            Pintar con <b style={{ color: RED }}>ROJO</b> para patología actual y <b style={{ color: BLUE }}>AZUL</b> para tratamiento realizado. Movilidad y Recesión: marcar 1, 2, 3 ó 4 si aplica.
          </div>

          {msg && <div className="txt-sm" style={{ color: msg.startsWith("✓") ? "var(--teal)" : "var(--rose)", margin: "8px 0" }}>{msg}</div>}
          {loading && <div className="txt-sm txt-muted" style={{ margin: "8px 0" }}>Cargando odontograma…</div>}

          <div className="odonto-scale-outer">
            <div className="odonto-scale-inner">
              <OdontoRow label="Recesión" list={QUADRANTS.perm_upper} field="rec" teeth={teeth} onChange={handleMovRec} />
              <OdontoRow label="Movilidad" list={QUADRANTS.perm_upper} field="mov" teeth={teeth} onChange={handleMovRec} />
              <ToothStrip list={QUADRANTS.perm_upper} size={44} pad={false} teeth={teeth} onFace={handleFace} />
              <ToothStrip list={QUADRANTS.temp_upper} size={36} pad={true} teeth={teeth} onFace={handleFace} />
              <ToothStrip list={QUADRANTS.temp_lower} size={36} pad={true} teeth={teeth} onFace={handleFace} />
              <ToothStrip list={QUADRANTS.perm_lower} size={44} pad={false} teeth={teeth} onFace={handleFace} />
              <OdontoRow label="Movilidad" list={QUADRANTS.perm_lower} field="mov" teeth={teeth} onChange={handleMovRec} />
              <OdontoRow label="Recesión" list={QUADRANTS.perm_lower} field="rec" teeth={teeth} onChange={handleMovRec} />
            </div>
          </div>

          <div className="legend">
            <div className="lg-title">K. Simbología del odontograma</div>
            <div className="lg-caption">Rojo = patología actual / por realizar &nbsp;·&nbsp; Azul = tratamiento realizado</div>
            <div className="legend-grid">
              <span className="row"><span className="sym-icon"><svg width="15" height="15" viewBox="0 0 15 15"><rect x="1.2" y="1.2" width="12.6" height="12.6" rx="2" fill={RED} /></svg></span><span className="desc">Caries</span></span>
              {LEGEND_WHOLE.slice(0, 7).map(([sym, label]) => (
                <span className="row" key={sym}><span className="sym-icon" dangerouslySetInnerHTML={{ __html: `<svg width="15" height="15" viewBox="0 0 15 15">${iconMarkup(sym, 15)}</svg>` }} /><span className="desc">{label}</span></span>
              ))}
              <span className="row"><span className="sym-icon"><svg width="15" height="15" viewBox="0 0 15 15"><rect x="1.2" y="1.2" width="12.6" height="12.6" rx="2" fill={BLUE} /></svg></span><span className="desc">Obturado</span></span>
              {LEGEND_WHOLE.slice(7).map(([sym, label]) => (
                <span className="row" key={sym}><span className="sym-icon" dangerouslySetInnerHTML={{ __html: `<svg width="15" height="15" viewBox="0 0 15 15">${iconMarkup(sym, 15)}</svg>` }} /><span className="desc">{label}</span></span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
