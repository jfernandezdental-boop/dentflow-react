import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { hoyISO, fmtFecha, edadDesde, escHtml } from "../lib/format";
import "../styles/clinico.css";

// Sugerencias editables de uso frecuente en odontología. La posología y las
// cantidades son un punto de partida: el profesional siempre las revisa.
const VADEMECUM = [
  { nombre_generico: "Amoxicilina", concentracion: "500 mg", forma_farmaceutica: "Cápsulas", cantidad: "21", via: "Oral", posologia: "1 cápsula cada 8 horas por 7 días" },
  { nombre_generico: "Amoxicilina + ácido clavulánico", concentracion: "875/125 mg", forma_farmaceutica: "Tabletas", cantidad: "14", via: "Oral", posologia: "1 tableta cada 12 horas por 7 días" },
  { nombre_generico: "Ibuprofeno", concentracion: "400 mg", forma_farmaceutica: "Tabletas", cantidad: "12", via: "Oral", posologia: "1 tableta cada 8 horas por 3 días, con alimentos" },
  { nombre_generico: "Paracetamol", concentracion: "500 mg", forma_farmaceutica: "Tabletas", cantidad: "12", via: "Oral", posologia: "1 tableta cada 8 horas si hay dolor" },
  { nombre_generico: "Ketorolaco", concentracion: "10 mg", forma_farmaceutica: "Tabletas", cantidad: "6", via: "Oral", posologia: "1 tableta cada 8 horas por 2 días" },
  { nombre_generico: "Naproxeno", concentracion: "550 mg", forma_farmaceutica: "Tabletas", cantidad: "10", via: "Oral", posologia: "1 tableta cada 12 horas por 5 días" },
  { nombre_generico: "Clindamicina", concentracion: "300 mg", forma_farmaceutica: "Cápsulas", cantidad: "28", via: "Oral", posologia: "1 cápsula cada 6 horas por 7 días" },
  { nombre_generico: "Metronidazol", concentracion: "500 mg", forma_farmaceutica: "Tabletas", cantidad: "21", via: "Oral", posologia: "1 tableta cada 8 horas por 7 días" },
  { nombre_generico: "Azitromicina", concentracion: "500 mg", forma_farmaceutica: "Tabletas", cantidad: "3", via: "Oral", posologia: "1 tableta cada 24 horas por 3 días" },
  { nombre_generico: "Dexametasona", concentracion: "4 mg", forma_farmaceutica: "Tabletas", cantidad: "4", via: "Oral", posologia: "1 tableta cada 12 horas por 2 días" },
  { nombre_generico: "Clorhexidina", concentracion: "0,12 %", forma_farmaceutica: "Colutorio 250 ml", cantidad: "1", via: "Tópica oral", posologia: "Enjuagar 15 ml por 30 segundos cada 12 horas por 7 días" },
];

// Cruce básico alergia ↔ medicamento para avisar antes de emitir. Es una ayuda,
// no reemplaza el criterio clínico.
const REGLAS_ALERGIA = [
  { alergia: /penicilin|amoxicil|ampicil|betalact/i, med: /amoxicil|ampicil|penicil|clavul/i, nombre: "penicilinas" },
  { alergia: /ibuprof|aine|antiinflam|diclofen|naprox|ketorol|aspirin|nimesul/i, med: /ibuprof|naprox|ketorol|diclofen|nimesul|aspirin/i, nombre: "antiinflamatorios (AINE)" },
  { alergia: /sulfa/i, med: /sulfa|trimetoprim/i, nombre: "sulfas" },
  { alergia: /paracetamol|acetaminof/i, med: /paracetamol|acetaminof/i, nombre: "paracetamol" },
  { alergia: /clindamicin/i, med: /clindamicin/i, nombre: "clindamicina" },
  { alergia: /metronidazol/i, med: /metronidazol/i, nombre: "metronidazol" },
  { alergia: /macr[oó]lid|azitromicin|eritromicin|claritromicin/i, med: /azitromicin|eritromicin|claritromicin/i, nombre: "macrólidos" },
];

const MED_VACIO = { nombre_generico: "", concentracion: "", forma_farmaceutica: "", cantidad: "", via: "Oral", posologia: "" };
const SEXO = { F: "Femenino", M: "Masculino", otro: "Otro" };

function formVacio(doctores) {
  const unico = doctores.length === 1 ? doctores[0] : null;
  return {
    id: null, numero: "", paciente_id: "", doctor_id: unico?.id || "", fecha: hoyISO(), peso: "",
    dx_cie10: "", dx_desc: "", profesional: unico?.nombre || "", registro: "", validez: "72 horas",
    indicaciones: "", observaciones: "", meds: [{ ...MED_VACIO }],
  };
}

function htmlReceta({ f, pac, establecimiento, telefono }) {
  const meds = f.meds.filter((m) => m.nombre_generico.trim());
  const filas = meds.map((m, i) => `<tr><td>${i + 1}</td><td><b>${escHtml(m.nombre_generico)}</b><br><small>${escHtml(m.concentracion)} · ${escHtml(m.forma_farmaceutica)}</small></td><td>${escHtml(m.cantidad)}</td><td>${escHtml(m.via)}</td><td>${escHtml(m.posologia)}</td></tr>`).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Receta ${escHtml(f.numero)}</title>
<style>
*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#1d2a31;margin:0;padding:34px 40px;font-size:13px;line-height:1.5}
.hd{display:flex;justify-content:space-between;border-bottom:3px solid #4A6C7C;padding-bottom:12px;margin-bottom:14px}
h1{font-size:19px;margin:0;color:#3A5766}.sub{color:#6b6b6b;font-size:12px}.no{text-align:right;font-weight:700;color:#3A5766}
.pt{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin-bottom:14px}.pt b{color:#4B5B66}
table{width:100%;border-collapse:collapse;margin:8px 0 14px}th{font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#6b6b6b;text-align:left;border-bottom:1.5px solid #cfd8d3;padding:6px 4px}
td{padding:9px 4px;border-bottom:1px dashed #cfd8d3;vertical-align:top}small{color:#6b6b6b}
.box{margin-bottom:12px}.sg{margin-top:70px;display:flex;justify-content:flex-end}.sg div{border-top:1px solid #1d2a31;padding-top:6px;min-width:250px;text-align:center}
.ft{margin-top:26px;font-size:11px;color:#6b6b6b;border-top:1px solid #e1e8e4;padding-top:8px}
@media print{body{padding:18px 24px}}
</style></head><body>
<div class="hd"><div><h1>${escHtml(establecimiento || "Consultorio odontológico")}</h1><div class="sub">${escHtml(telefono || "")}</div><div class="sub">Receta médica odontológica</div></div>
<div class="no">N.º ${escHtml(f.numero || "—")}<div class="sub" style="font-weight:400">${escHtml(fmtFecha(f.fecha))}</div></div></div>
<div class="pt"><div><b>Paciente:</b> ${escHtml(pac?.nombre || "—")}</div><div><b>Cédula:</b> ${escHtml(pac?.cedula || "—")}</div>
<div><b>Edad:</b> ${escHtml(edadDesde(pac?.fecha_nac) || "—")}${edadDesde(pac?.fecha_nac) ? " años" : ""}</div><div><b>Sexo:</b> ${escHtml(SEXO[pac?.genero] || "—")}</div>
<div><b>Peso:</b> ${escHtml(f.peso ? f.peso + " kg" : "—")}</div><div><b>Alergias:</b> ${escHtml(pac?.alergias || "No refiere")}</div></div>
<div class="box"><b>Diagnóstico:</b> ${escHtml([f.dx_cie10, f.dx_desc].filter(Boolean).join(" — ") || "—")}</div>
<table><thead><tr><th>#</th><th>Medicamento</th><th>Cant.</th><th>Vía</th><th>Indicación</th></tr></thead><tbody>${filas || '<tr><td colspan="5">Sin medicamentos</td></tr>'}</tbody></table>
${f.indicaciones ? `<div class="box"><b>Indicaciones generales:</b><br>${escHtml(f.indicaciones).replace(/\n/g, "<br>")}</div>` : ""}
${f.observaciones ? `<div class="box"><b>Observaciones / próxima cita:</b><br>${escHtml(f.observaciones).replace(/\n/g, "<br>")}</div>` : ""}
<div class="sg"><div>${escHtml(f.profesional || "Profesional")}<br><small>${escHtml(f.registro ? "Registro: " + f.registro : "")}</small></div></div>
<div class="ft">Validez de la receta: ${escHtml(f.validez)} desde la fecha de emisión.</div>
<script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body></html>`;
}

function Preview({ f, pac, establecimiento, telefono }) {
  const meds = f.meds.filter((m) => m.nombre_generico.trim());
  return (
    <div className="rx-paper">
      <div className="hd">
        <div>
          <h2>{establecimiento || "Consultorio odontológico"}</h2>
          {telefono && <div className="sub">{telefono}</div>}
          <div className="sub">Receta médica odontológica</div>
        </div>
        <div className="no">N.º {f.numero || "—"}<div className="sub" style={{ fontWeight: 400 }}>{fmtFecha(f.fecha)}</div></div>
      </div>
      <div className="pt">
        <div><b>Paciente:</b> {pac?.nombre || "—"}</div>
        <div><b>Cédula:</b> {pac?.cedula || "—"}</div>
        <div><b>Edad:</b> {edadDesde(pac?.fecha_nac) ? edadDesde(pac?.fecha_nac) + " años" : "—"}</div>
        <div><b>Sexo:</b> {SEXO[pac?.genero] || "—"}</div>
        <div><b>Peso:</b> {f.peso ? f.peso + " kg" : "—"}</div>
        <div><b>Alergias:</b> {pac?.alergias || "No refiere"}</div>
      </div>
      <div style={{ marginBottom: 6 }}><b>Diagnóstico:</b> {[f.dx_cie10, f.dx_desc].filter(Boolean).join(" — ") || "—"}</div>
      <table>
        <thead><tr><th>#</th><th>Medicamento</th><th>Cant.</th><th>Vía</th><th>Indicación</th></tr></thead>
        <tbody>
          {meds.length === 0 && <tr><td colSpan={5} style={{ color: "var(--muted)" }}>Agrega medicamentos para ver la receta.</td></tr>}
          {meds.map((m, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td><b>{m.nombre_generico}</b><br /><span style={{ color: "var(--muted)" }}>{[m.concentracion, m.forma_farmaceutica].filter(Boolean).join(" · ")}</span></td>
              <td>{m.cantidad}</td><td>{m.via}</td><td>{m.posologia}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {f.indicaciones && <div style={{ marginBottom: 8 }}><b>Indicaciones generales:</b><div style={{ whiteSpace: "pre-wrap" }}>{f.indicaciones}</div></div>}
      {f.observaciones && <div style={{ marginBottom: 8 }}><b>Observaciones / próxima cita:</b><div style={{ whiteSpace: "pre-wrap" }}>{f.observaciones}</div></div>}
      <div className="sg"><div>{f.profesional || "Profesional"}<div style={{ color: "var(--muted)" }}>{f.registro ? "Registro: " + f.registro : ""}</div></div></div>
      <div className="sub" style={{ marginTop: 14 }}>Validez de la receta: {f.validez} desde la emisión.</div>
    </div>
  );
}

export default function Recetario() {
  const { profile, consultorio, rolUi } = useAuth();
  const consultorioId = profile?.consultorio_id || null;
  const [pacientes, setPacientes] = useState([]);
  const [doctores, setDoctores] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("nueva");
  const [f, setF] = useState(formVacio([]));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // {tipo:'ok'|'err', txt}
  const [q, setQ] = useState("");

  async function cargar() {
    if (!consultorioId) { setLoading(false); return; }
    const [p, d, r] = await Promise.all([
      supabase.from("pacientes").select("id,nombre,cedula,fecha_nac,genero,alergias").eq("consultorio_id", consultorioId).eq("activo", true).order("nombre"),
      supabase.from("doctores").select("id,nombre,especialidad").eq("consultorio_id", consultorioId).order("nombre"),
      supabase.from("recetas").select("*").eq("consultorio_id", consultorioId).order("created_at", { ascending: false }).limit(150),
    ]);
    setPacientes(p.data || []);
    setDoctores(d.data || []);
    setRecetas(r.data || []);
    setF((cur) => (cur.numero || cur.paciente_id ? cur : formVacio(d.data || [])));
    setLoading(false);
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [consultorioId]);

  const pac = useMemo(() => pacientes.find((p) => p.id === f.paciente_id) || null, [pacientes, f.paciente_id]);
  const nombrePac = useMemo(() => Object.fromEntries(pacientes.map((p) => [p.id, p.nombre])), [pacientes]);

  const alertas = useMemo(() => {
    if (!pac?.alergias) return [];
    const out = [];
    for (const r of REGLAS_ALERGIA) {
      if (!r.alergia.test(pac.alergias)) continue;
      const afectados = f.meds.filter((m) => r.med.test(m.nombre_generico)).map((m) => m.nombre_generico);
      if (afectados.length) out.push(`${pac.nombre} refiere alergia a ${r.nombre}. Revisa: ${afectados.join(", ")}.`);
    }
    return out;
  }, [pac, f.meds]);

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setMed = (i, k, v) => setF((s) => ({ ...s, meds: s.meds.map((m, j) => (j === i ? { ...m, [k]: v } : m)) }));
  const addMed = (m) => setF((s) => {
    const vacios = s.meds.length === 1 && !s.meds[0].nombre_generico.trim();
    return { ...s, meds: vacios ? [{ ...(m || MED_VACIO) }] : [...s.meds, { ...(m || MED_VACIO) }] };
  });
  const delMed = (i) => setF((s) => ({ ...s, meds: s.meds.length > 1 ? s.meds.filter((_, j) => j !== i) : [{ ...MED_VACIO }] }));

  function onDoctor(id) {
    const d = doctores.find((x) => x.id === id);
    setF((s) => ({ ...s, doctor_id: id, profesional: d ? d.nombre : s.profesional }));
  }

  async function siguienteNumero() {
    const { data } = await supabase.from("recetas").select("numero").eq("consultorio_id", consultorioId).order("created_at", { ascending: false }).limit(1);
    const ult = data?.[0]?.numero || "";
    const n = parseInt((ult.match(/(\d+)\s*$/) || [])[1] || "0", 10) + 1;
    return "RX-" + String(n).padStart(4, "0");
  }

  async function guardar() {
    setMsg(null);
    if (!f.paciente_id) return setMsg({ tipo: "err", txt: "Selecciona el paciente." });
    const meds = f.meds.filter((m) => m.nombre_generico.trim());
    if (meds.length === 0) return setMsg({ tipo: "err", txt: "Agrega al menos un medicamento." });
    if (!f.profesional.trim()) return setMsg({ tipo: "err", txt: "Indica el profesional que prescribe." });
    setSaving(true);
    const base = {
      paciente_id: f.paciente_id, doctor_id: f.doctor_id || null, fecha: f.fecha,
      diagnostico_cie10: f.dx_cie10.trim() || null, diagnostico_desc: f.dx_desc.trim() || null,
      profesional: f.profesional.trim(), registro_profesional: f.registro.trim() || null,
      establecimiento: consultorio?.nombre || null, validez: f.validez,
      indicaciones: f.indicaciones.trim() || null, observaciones: f.observaciones.trim() || null,
      campos: { peso: f.peso || null, paciente_nombre: pac?.nombre, cedula: pac?.cedula, alergias: pac?.alergias || null },
    };
    let recetaId = f.id;
    let numero = f.numero;
    if (f.id) {
      const { error } = await supabase.from("recetas").update(base).eq("id", f.id);
      if (error) { setSaving(false); return setMsg({ tipo: "err", txt: "No se pudo guardar: " + error.message }); }
      await supabase.from("receta_medicamentos").delete().eq("receta_id", f.id);
    } else {
      for (let intento = 0; intento < 2; intento++) {
        numero = await siguienteNumero();
        const res = await supabase.from("recetas").insert({ ...base, consultorio_id: consultorioId, numero }).select("id").single();
        if (!res.error) { recetaId = res.data.id; break; }
        if (res.error.code !== "23505" || intento === 1) { setSaving(false); return setMsg({ tipo: "err", txt: "No se pudo guardar: " + res.error.message }); }
      }
    }
    const { error: eMeds } = await supabase.from("receta_medicamentos").insert(
      meds.map((m, i) => ({ receta_id: recetaId, orden: i + 1, nombre_generico: m.nombre_generico.trim(), concentracion: m.concentracion || null, forma_farmaceutica: m.forma_farmaceutica || null, cantidad: m.cantidad || null, via: m.via || null, posologia: m.posologia || null }))
    );
    setSaving(false);
    if (eMeds) return setMsg({ tipo: "err", txt: "La receta se creó pero fallaron los medicamentos: " + eMeds.message });
    setF((s) => ({ ...s, id: recetaId, numero }));
    setMsg({ tipo: "ok", txt: `Receta ${numero} guardada.` });
    const r = await supabase.from("recetas").select("*").eq("consultorio_id", consultorioId).order("created_at", { ascending: false }).limit(150);
    setRecetas(r.data || []);
  }

  async function abrir(r) {
    const { data } = await supabase.from("receta_medicamentos").select("*").eq("receta_id", r.id).order("orden");
    setF({
      id: r.id, numero: r.numero, paciente_id: r.paciente_id || "", doctor_id: r.doctor_id || "", fecha: r.fecha || hoyISO(),
      peso: r.campos?.peso || "", dx_cie10: r.diagnostico_cie10 || "", dx_desc: r.diagnostico_desc || "",
      profesional: r.profesional || "", registro: r.registro_profesional || "", validez: r.validez || "72 horas",
      indicaciones: r.indicaciones || "", observaciones: r.observaciones || "",
      meds: (data || []).length ? data.map((m) => ({ nombre_generico: m.nombre_generico || "", concentracion: m.concentracion || "", forma_farmaceutica: m.forma_farmaceutica || "", cantidad: m.cantidad || "", via: m.via || "", posologia: m.posologia || "" })) : [{ ...MED_VACIO }],
    });
    setMsg(null);
    setTab("nueva");
  }

  async function eliminar(r, e) {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar la receta ${r.numero}? Esta acción no se puede deshacer.`)) return;
    await supabase.from("receta_medicamentos").delete().eq("receta_id", r.id);
    const { error } = await supabase.from("recetas").delete().eq("id", r.id);
    if (error) return window.alert("No se pudo eliminar: " + error.message);
    if (f.id === r.id) setF(formVacio(doctores));
    cargar();
  }

  function nueva() { setF(formVacio(doctores)); setMsg(null); setTab("nueva"); }

  function imprimir() {
    const meds = f.meds.filter((m) => m.nombre_generico.trim());
    if (!f.paciente_id || meds.length === 0) return setMsg({ tipo: "err", txt: "Completa paciente y medicamentos antes de imprimir." });
    if (!f.numero) setMsg({ tipo: "err", txt: "Guarda la receta primero para que lleve su número." });
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return setMsg({ tipo: "err", txt: "El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio." });
    w.document.write(htmlReceta({ f, pac, establecimiento: consultorio?.nombre, telefono: consultorio?.telefono }));
    w.document.close();
  }

  const recetasFiltradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return recetas;
    return recetas.filter((r) => [r.numero, nombrePac[r.paciente_id], r.diagnostico_desc, r.diagnostico_cie10].some((s) => (s || "").toLowerCase().includes(t)));
  }, [recetas, q, nombrePac]);

  if (!consultorioId) return <div className="mod"><div className="card"><div className="empty"><div className="ic">🏥</div><div className="t">Sin clínica asociada</div></div></div></div>;
  if (rolUi === "personal" || rolUi === "paciente") return <div className="mod"><div className="card"><div className="empty"><div className="ic">🔒</div><div className="t">Sin acceso</div><div className="s">El recetario es solo para el equipo clínico.</div></div></div></div>;

  return (
    <div className="mod">
      <div className="mh">
        <div>
          <div className="mh-t">💊 Recetario odontológico</div>
          <div className="mh-s">Prescripción por nombre genérico, con vista previa lista para imprimir</div>
        </div>
        <div className="mh-a">
          <div className="cal-view-toggle" role="tablist">
            <button type="button" className={"cvt-btn" + (tab === "nueva" ? " on" : "")} onClick={() => setTab("nueva")}>✍️ Receta</button>
            <button type="button" className={"cvt-btn" + (tab === "historial" ? " on" : "")} onClick={() => setTab("historial")}>🗂 Emitidas ({recetas.length})</button>
          </div>
          <button className="btn-sm" onClick={nueva}>+ Nueva receta</button>
        </div>
      </div>

      {loading ? <div className="sk" style={{ height: 380 }} /> : tab === "historial" ? (
        <div>
          <div className="toolbar"><div className="search"><input className="fi sm" placeholder="Buscar por número, paciente o diagnóstico…" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
          <div className="card">
            {recetasFiltradas.length === 0 ? (
              <div className="empty"><div className="ic">💊</div><div className="t">{recetas.length ? "Sin resultados" : "Aún no has emitido recetas"}</div><div className="s">{recetas.length ? "Prueba con otro término de búsqueda." : "Las recetas que guardes aparecerán aquí para reimprimirlas o editarlas."}</div></div>
            ) : (
              <div className="rx-hist">
                {recetasFiltradas.map((r, i) => (
                  <div key={r.id} className="rx-hist-i" style={i === 0 ? { borderTop: "none" } : null} onClick={() => abrir(r)}>
                    <div className="no">{r.numero}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="fw6">{nombrePac[r.paciente_id] || r.campos?.paciente_nombre || "Paciente"}</div>
                      <div className="txt-muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{[r.diagnostico_cie10, r.diagnostico_desc].filter(Boolean).join(" — ") || "Sin diagnóstico"}</div>
                    </div>
                    <div className="txt-muted mono">{fmtFecha(r.fecha, { day: "2-digit", month: "short", year: "numeric" })}</div>
                    <button type="button" className="rx-x" title="Eliminar" onClick={(e) => eliminar(r, e)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rx-grid">
          <div className="card">
            <div className="card-b">
              <div className="sec-t">Paciente y prescriptor</div>
              <div className="g2">
                <div className="fl"><label>Paciente *</label>
                  <select className="fi sm" value={f.paciente_id} onChange={(e) => set("paciente_id", e.target.value)}>
                    <option value="">Seleccionar…</option>
                    {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div className="fl"><label>Fecha</label><input className="fi sm" type="date" value={f.fecha} onChange={(e) => set("fecha", e.target.value)} /></div>
              </div>
              {pac && <div className="txt-muted" style={{ margin: "-4px 0 12px" }}>{[pac.cedula && "CI " + pac.cedula, edadDesde(pac.fecha_nac) && edadDesde(pac.fecha_nac) + " años", SEXO[pac.genero]].filter(Boolean).join(" · ")}{pac.alergias ? ` · ⚠️ Alergias: ${pac.alergias}` : ""}</div>}
              <div className="g3">
                <div className="fl"><label>Doctor</label>
                  <select className="fi sm" value={f.doctor_id} onChange={(e) => onDoctor(e.target.value)}>
                    <option value="">—</option>
                    {doctores.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                  </select>
                </div>
                <div className="fl"><label>Profesional *</label><input className="fi sm" value={f.profesional} onChange={(e) => set("profesional", e.target.value)} /></div>
                <div className="fl"><label>Registro (MSP/Senescyt)</label><input className="fi sm" value={f.registro} onChange={(e) => set("registro", e.target.value)} /></div>
              </div>
              <div className="g3">
                <div className="fl"><label>Peso (kg)</label><input className="fi sm mono" type="number" min="0" value={f.peso} onChange={(e) => set("peso", e.target.value)} /></div>
                <div className="fl"><label>CIE-10</label><input className="fi sm mono" placeholder="K02.1" value={f.dx_cie10} onChange={(e) => set("dx_cie10", e.target.value.toUpperCase())} /></div>
                <div className="fl"><label>Validez</label>
                  <select className="fi sm" value={f.validez} onChange={(e) => set("validez", e.target.value)}>
                    <option>72 horas</option><option>15 días</option><option>30 días</option>
                  </select>
                </div>
              </div>
              <div className="fl" style={{ marginBottom: 14 }}><label>Diagnóstico</label><input className="fi sm" placeholder="Ej. Caries de la dentina" value={f.dx_desc} onChange={(e) => set("dx_desc", e.target.value)} /></div>

              <div className="sec-t">Medicamentos</div>
              {alertas.map((a) => <div key={a} className="warn-box"><span>⚠️</span><span>{a}</span></div>)}
              <div className="txt-muted" style={{ marginBottom: 6 }}>Sugerencias editables (toca para agregar):</div>
              <div className="vm" style={{ marginBottom: 14 }}>
                {VADEMECUM.map((m) => <button key={m.nombre_generico} type="button" onClick={() => addMed(m)}>+ {m.nombre_generico.split(" +")[0]} {m.concentracion.split("/")[0]}</button>)}
              </div>
              <div className="rx-row rx-row-h"><span>Genérico</span><span>Concentración</span><span>Forma</span><span>Cant.</span><span>Vía</span><span /></div>
              {f.meds.map((m, i) => (
                <div key={i} className="rx-row" style={{ paddingBottom: 8, borderBottom: i < f.meds.length - 1 ? "1px dashed var(--border)" : "none" }}>
                  <input className="fi sm" placeholder="Nombre genérico" value={m.nombre_generico} onChange={(e) => setMed(i, "nombre_generico", e.target.value)} />
                  <input className="fi sm" placeholder="500 mg" value={m.concentracion} onChange={(e) => setMed(i, "concentracion", e.target.value)} />
                  <input className="fi sm" placeholder="Cápsulas" value={m.forma_farmaceutica} onChange={(e) => setMed(i, "forma_farmaceutica", e.target.value)} />
                  <input className="fi sm mono" placeholder="21" value={m.cantidad} onChange={(e) => setMed(i, "cantidad", e.target.value)} />
                  <input className="fi sm" placeholder="Oral" value={m.via} onChange={(e) => setMed(i, "via", e.target.value)} />
                  <button type="button" className="rx-x" onClick={() => delMed(i)} title="Quitar">✕</button>
                  <input className="fi sm rx-pos" placeholder="Posología: dosis, frecuencia y duración" value={m.posologia} onChange={(e) => setMed(i, "posologia", e.target.value)} />
                </div>
              ))}
              <button type="button" className="btn-sm sec" style={{ marginBottom: 16 }} onClick={() => addMed(null)}>+ Medicamento manual</button>

              <div className="sec-t">Indicaciones</div>
              <div className="fl" style={{ marginBottom: 12 }}><label>Indicaciones no farmacológicas</label><textarea className="fi sm" rows={2} placeholder="Dieta blanda, evitar masticar del lado afectado…" value={f.indicaciones} onChange={(e) => set("indicaciones", e.target.value)} /></div>
              <div className="fl" style={{ marginBottom: 4 }}><label>Observaciones / próxima cita</label><textarea className="fi sm" rows={2} value={f.observaciones} onChange={(e) => set("observaciones", e.target.value)} /></div>
            </div>
          </div>

          <div>
            <div className="flex gap8 mb14 no-print" style={{ flexWrap: "wrap", alignItems: "center" }}>
              <button className="btn-sm" type="button" onClick={guardar} disabled={saving}>{saving ? "Guardando…" : f.id ? "💾 Actualizar receta" : "💾 Guardar receta"}</button>
              <button className="btn-sm sec" type="button" onClick={imprimir}>🖨 Imprimir / PDF</button>
              {msg && <span className="txt-sm fw6" style={{ color: msg.tipo === "ok" ? "var(--green)" : "var(--rose)" }}>{msg.txt}</span>}
            </div>
            <Preview f={f} pac={pac} establecimiento={consultorio?.nombre} telefono={consultorio?.telefono} />
          </div>
        </div>
      )}
    </div>
  );
}
