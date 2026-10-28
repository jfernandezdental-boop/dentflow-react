import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { CIE10 } from "../lib/cie10";
import { hoyISO, fmtFecha, edadDesde, escHtml } from "../lib/format";
import "../styles/clinico.css";

const AP = [["alergia_antibiotico", "Alergia a antibióticos"], ["alergia_anestesia", "Alergia a anestésicos"], ["hemorragias", "Hemorragias"], ["vih", "VIH / SIDA"], ["tuberculosis", "Tuberculosis"], ["asma", "Asma"], ["diabetes", "Diabetes"], ["hipertension", "Hipertensión arterial"], ["cardiopatia", "Enfermedad cardiaca"], ["otro", "Otro"]];
const AF = [["cardiopatia", "Cardiopatía"], ["hipertension", "Hipertensión arterial"], ["cerebrovascular", "Enfermedad cerebrovascular"], ["endocrino", "Endócrino-metabólico"], ["cancer", "Cáncer"], ["tuberculosis", "Tuberculosis"], ["mental", "Enfermedad mental"], ["infecciosa", "Enfermedad infecciosa"], ["malformacion", "Malformación"], ["otro", "Otro"]];
const EXAMEN = [["labios", "Labios"], ["mejillas", "Mejillas"], ["maxilar_sup", "Maxilar superior"], ["maxilar_inf", "Maxilar inferior"], ["lengua", "Lengua"], ["paladar", "Paladar"], ["piso", "Piso de la boca"], ["carrillos", "Carrillos"], ["glandulas", "Glándulas salivales"], ["orofaringe", "Orofaringe"], ["atm", "A.T.M."], ["ganglios", "Ganglios"]];
const PIEZAS_OHI = ["16", "11", "26", "36", "31", "46"];
const SEL = (arr) => arr.filter((x) => x && (typeof x === "string" || x.v !== false));
const keyOf = (x) => (typeof x === "string" ? x : x.k || x.key || x.id || x.codigo || x.nombre);

function formVacio(pac, consultorio, doctorId) {
  return {
    id: null, fecha: hoyISO(), doctor_id: doctorId || "",
    c: { establecimiento: consultorio?.nombre || "", unicodigo: "", archivo: pac?.numero_historia || "", motivo: "", enfermedad_actual: "", constantes: { pa: "", fc: "", fr: "", temp: "", peso: "", talla: "" }, plan_tratamiento: "", consentimiento: { aceptado: false, firmante: "", fecha: "" }, cpo: { C: "", P: "", O: "", c: "", e: "", o: "" } },
    ap: [], ap_otro: "", af: [], af_otro: "", examen: {}, ind: { higiene: {}, enf_periodontal: "", mal_oclusion: "", fluorosis: "" },
    dx: [], evo: [],
  };
}
function desdeFila(r) {
  const base = formVacio(null, null, r.doctor_id);
  const c = r.campos || {};
  const marcados = (arr) => SEL(Array.isArray(arr) ? arr : []).map(keyOf).filter(Boolean);
  const otro = (arr, k) => { const o = (Array.isArray(arr) ? arr : []).find((x) => x && typeof x === "object" && keyOf(x) === k); return o?.obs || o?.otro || ""; };
  const ex = {};
  (Array.isArray(r.examen_estomatognatico) ? r.examen_estomatognatico : []).forEach((x) => { if (x && typeof x === "object" && keyOf(x)) ex[keyOf(x)] = { estado: x.estado || (x.patologico ? "patologico" : "normal"), obs: x.obs || x.descripcion || "" }; });
  return {
    ...base, id: r.id, fecha: r.fecha || hoyISO(),
    c: { ...base.c, ...c, constantes: { ...base.c.constantes, ...(c.constantes || {}) }, consentimiento: { ...base.c.consentimiento, ...(c.consentimiento || {}) }, cpo: { ...base.c.cpo, ...(c.cpo || {}) } },
    ap: marcados(r.antecedentes_personales), ap_otro: otro(r.antecedentes_personales, "otro"), af: marcados(r.antecedentes_familiares), af_otro: otro(r.antecedentes_familiares, "otro"),
    examen: ex, ind: { ...base.ind, ...(r.indicadores || {}), higiene: { ...((r.indicadores || {}).higiene || {}) } },
    dx: (Array.isArray(r.diagnosticos) ? r.diagnosticos : []).map((x) => ({ codigo_cie10: x.codigo_cie10 || x.codigo || x.cie10 || "", descripcion: x.descripcion || x.desc || "", tipo: x.tipo || "PRE", pieza: x.pieza || "" })),
    evo: (Array.isArray(r.evolucion) ? r.evolucion : []).map((x) => ({ numero_sesion: x.numero_sesion || x.sesion || "", fecha: x.fecha || "", diagnosticos_complicaciones: x.diagnosticos_complicaciones || x.diagnostico || "", procedimientos: x.procedimientos || "", prescripciones: x.prescripciones || "", firma: x.firma || "" })),
  };
}
const num = (v) => Number(v) || 0;

function htmlHc(f, pac, doctor) {
  const etq = (lista, sel, otro) => lista.filter(([k]) => sel.includes(k)).map(([k, l]) => (k === "otro" && otro ? `Otro: ${otro}` : l)).join(", ") || "Ninguno referido";
  const ohi = ohiCalc(f.ind.higiene);
  const filasEx = EXAMEN.filter(([k]) => f.examen[k]).map(([k, l]) => `<tr><td>${l}</td><td>${f.examen[k].estado === "patologico" ? "Patológico" : "Normal"}</td><td>${escHtml(f.examen[k].obs)}</td></tr>`).join("");
  const filasDx = f.dx.filter((x) => x.codigo_cie10 || x.descripcion).map((x) => `<tr><td>${escHtml(x.codigo_cie10)}</td><td>${escHtml(x.descripcion)}</td><td>${escHtml(x.pieza)}</td><td>${x.tipo === "DEF" ? "Definitivo" : "Presuntivo"}</td></tr>`).join("");
  const filasEv = f.evo.map((x) => `<tr><td>${escHtml(x.numero_sesion)}<br>${escHtml(x.fecha)}</td><td>${escHtml(x.diagnosticos_complicaciones)}</td><td>${escHtml(x.procedimientos)}</td><td>${escHtml(x.prescripciones)}</td><td>${escHtml(x.firma)}</td></tr>`).join("");
  const k = f.c.constantes, cp = f.c.cpo;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>HC ${escHtml(pac?.nombre)}</title><style>
*{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11.5px;color:#1d2a31;margin:0;padding:22px 28px}h1{font-size:16px;margin:0}h2{font-size:12px;background:#4A6C7C;color:#fff;padding:4px 8px;margin:14px 0 6px}
table{width:100%;border-collapse:collapse;margin-bottom:4px}th,td{border:1px solid #c7d2cc;padding:4px 6px;text-align:left;vertical-align:top}th{background:#eef3f0;font-size:10.5px}p{margin:3px 0}.g{display:grid;grid-template-columns:1fr 1fr 1fr;gap:3px 14px}@media print{body{padding:10px 14px}}
</style></head><body>
<h1>Historia clínica única de odontología — Formulario 033</h1><p>${escHtml(f.c.establecimiento)} · Código: ${escHtml(f.c.unicodigo)} · N.º HC: ${escHtml(f.c.archivo)} · Fecha: ${escHtml(fmtFecha(f.fecha))}</p>
<h2>A. Datos del paciente</h2><div class="g"><p><b>Paciente:</b> ${escHtml(pac?.nombre)}</p><p><b>Cédula:</b> ${escHtml(pac?.cedula || "—")}</p><p><b>Edad:</b> ${escHtml(edadDesde(pac?.fecha_nac) || "—")}</p><p><b>Profesional:</b> ${escHtml(doctor || "—")}</p></div>
<h2>B. Motivo de consulta</h2><p>${escHtml(f.c.motivo) || "—"}</p><h2>C. Enfermedad o problema actual</h2><p>${escHtml(f.c.enfermedad_actual) || "—"}</p>
<h2>D. Antecedentes</h2><p><b>Personales:</b> ${escHtml(etq(AP, f.ap, f.ap_otro))}</p><p><b>Familiares:</b> ${escHtml(etq(AF, f.af, f.af_otro))}</p>
<h2>E. Constantes vitales</h2><p>PA ${escHtml(k.pa)} · FC ${escHtml(k.fc)} · FR ${escHtml(k.fr)} · T° ${escHtml(k.temp)} · Peso ${escHtml(k.peso)} kg · Talla ${escHtml(k.talla)} cm</p>
<h2>F. Examen del sistema estomatognático</h2><table><tr><th>Región</th><th>Estado</th><th>Descripción</th></tr>${filasEx || "<tr><td colspan=3>Sin registros</td></tr>"}</table>
<h2>G. Indicadores de salud bucal</h2><p>Higiene oral simplificada: placa ${ohi.placa.toFixed(2)} · cálculo ${ohi.calculo.toFixed(2)} · total ${ohi.total.toFixed(2)} (${ohi.nivel}) · Enf. periodontal: ${escHtml(f.ind.enf_periodontal || "—")} · Mal oclusión: ${escHtml(f.ind.mal_oclusion || "—")} · Fluorosis: ${escHtml(f.ind.fluorosis || "—")}</p>
<h2>H. Índices CPO-ceo</h2><p>C ${num(cp.C)} · P ${num(cp.P)} · O ${num(cp.O)} → CPO-D ${num(cp.C) + num(cp.P) + num(cp.O)} &nbsp;|&nbsp; c ${num(cp.c)} · e ${num(cp.e)} · o ${num(cp.o)} → ceo-d ${num(cp.c) + num(cp.e) + num(cp.o)}</p>
<h2>I. Diagnóstico</h2><table><tr><th>CIE-10</th><th>Descripción</th><th>Pieza</th><th>Tipo</th></tr>${filasDx || "<tr><td colspan=4>Sin diagnósticos</td></tr>"}</table>
<h2>J. Plan de tratamiento</h2><p>${escHtml(f.c.plan_tratamiento).replace(/\n/g, "<br>") || "—"}</p>
<h2>K. Evolución y prescripciones</h2><table><tr><th>Sesión / fecha</th><th>Diagnósticos y complicaciones</th><th>Procedimientos</th><th>Prescripciones</th><th>Firma</th></tr>${filasEv || "<tr><td colspan=5>Sin sesiones</td></tr>"}</table>
<h2>L. Consentimiento informado</h2><p>${f.c.consentimiento.aceptado ? `El paciente / representante ${escHtml(f.c.consentimiento.firmante || "")} aceptó el tratamiento propuesto${f.c.consentimiento.fecha ? " el " + escHtml(fmtFecha(f.c.consentimiento.fecha)) : ""}.` : "Pendiente de firma."}</p>
<script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body></html>`;
}
function ohiCalc(h) {
  const v = PIEZAS_OHI.map((p) => h[p]).filter(Boolean);
  const n = v.length || 1;
  const placa = v.reduce((s, x) => s + num(x.placa), 0) / n, calculo = v.reduce((s, x) => s + num(x.calculo), 0) / n;
  const total = v.length ? placa + calculo : 0;
  return { placa: v.length ? placa : 0, calculo: v.length ? calculo : 0, total, nivel: !v.length ? "sin datos" : total <= 1.2 ? "bueno" : total <= 3 ? "regular" : "malo" };
}

function Sec({ letra, titulo, children }) {
  return <div className="f33-sec"><div className="f33-h"><b>{letra}</b><span>{titulo}</span></div>{children}</div>;
}

export default function HcMsp({ irA }) {
  const { profile, consultorio, rolUi } = useAuth();
  const consultorioId = profile?.consultorio_id || null;
  const puedeEscribir = ["admin", "doctor", "recepcionista"].includes(rolUi);
  const [pacs, setPacs] = useState([]);
  const [doctores, setDoctores] = useState([]);
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [pac, setPac] = useState(null);
  const [filas, setFilas] = useState([]);
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!consultorioId) return;
    Promise.all([
      supabase.from("pacientes").select("id,nombre,cedula,fecha_nac,genero,numero_historia,doctor_id").eq("consultorio_id", consultorioId).eq("activo", true).order("nombre").limit(1500),
      supabase.from("doctores").select("id,nombre").eq("consultorio_id", consultorioId).order("nombre"),
    ]).then(([p, d]) => { setPacs(p.data || []); setDoctores(d.data || []); });
  }, [consultorioId]);

  const sugerencias = useMemo(() => { const t = q.trim().toLowerCase(); return (t ? pacs.filter((p) => p.nombre.toLowerCase().includes(t) || (p.cedula || "").includes(t)) : pacs).slice(0, 8); }, [pacs, q]);
  const nombreDoc = useMemo(() => Object.fromEntries(doctores.map((d) => [d.id, d.nombre])), [doctores]);

  async function elegir(p) {
    setPac(p); setQ(p.nombre); setAbierto(false); setF(null); setMsg(null);
    const { data, error } = await supabase.from("historias_clinicas_msp").select("*").eq("paciente_id", p.id).order("fecha", { ascending: false }).order("created_at", { ascending: false });
    if (error) setMsg({ t: "err", txt: "No se pudieron cargar las historias: " + error.message });
    setFilas(data || []);
  }

  const set = (path, v) => setF((s) => { const n = structuredClone(s); const ks = path.split("."); let o = n; ks.slice(0, -1).forEach((k) => { o = o[k]; }); o[ks.at(-1)] = v; return n; });
  const toggle = (campo, k) => setF((s) => ({ ...s, [campo]: s[campo].includes(k) ? s[campo].filter((x) => x !== k) : [...s[campo], k] }));
  const ohi = useMemo(() => (f ? ohiCalc(f.ind.higiene) : null), [f]);

  function payload() {
    const lista = (sel, def, otro) => sel.map((k) => ({ k, label: def.find(([x]) => x === k)?.[1] || k, v: true, ...(k === "otro" && otro ? { obs: otro } : {}) }));
    return {
      paciente_id: pac.id, doctor_id: f.doctor_id || null, fecha: f.fecha, campos: f.c,
      antecedentes_personales: lista(f.ap, AP, f.ap_otro), antecedentes_familiares: lista(f.af, AF, f.af_otro),
      examen_estomatognatico: EXAMEN.filter(([k]) => f.examen[k]).map(([k, l]) => ({ k, label: l, estado: f.examen[k].estado, obs: f.examen[k].obs || "" })),
      indicadores: f.ind, diagnosticos: f.dx.filter((x) => x.codigo_cie10 || x.descripcion), evolucion: f.evo,
    };
  }
  async function guardar() {
    setSaving(true); setMsg(null);
    const body = payload();
    const res = f.id ? await supabase.from("historias_clinicas_msp").update(body).eq("id", f.id).select("id").single() : await supabase.from("historias_clinicas_msp").insert({ ...body, consultorio_id: consultorioId }).select("id").single();
    setSaving(false);
    if (res.error) return setMsg({ t: "err", txt: "No se pudo guardar: " + res.error.message });
    setF((s) => ({ ...s, id: res.data.id }));
    setMsg({ t: "ok", txt: "Historia guardada ✓" });
    const { data } = await supabase.from("historias_clinicas_msp").select("*").eq("paciente_id", pac.id).order("fecha", { ascending: false }).order("created_at", { ascending: false });
    setFilas(data || []);
  }
  function imprimir() {
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return setMsg({ t: "err", txt: "El navegador bloqueó la ventana. Permite ventanas emergentes para imprimir." });
    w.document.write(htmlHc(f, pac, nombreDoc[f.doctor_id])); w.document.close();
  }

  if (!consultorioId) return <div className="mod"><div className="card"><div className="empty"><div className="ic">🏥</div><div className="t">Sin clínica asociada</div></div></div></div>;

  return (
    <div className="mod">
      <div className="mh">
        <div><div className="mh-t">📋 HC MSP · Formulario 033</div><div className="mh-s">Historia clínica única de odontología, con índices CPO-ceo, higiene oral y diagnósticos CIE-10</div></div>
        {f && <div className="mh-a"><button className="btn-sm sec" onClick={() => { setF(null); setMsg(null); }}>← Volver</button>{puedeEscribir && <button className="btn-sm" onClick={guardar} disabled={saving}>{saving ? "Guardando…" : f.id ? "💾 Actualizar" : "💾 Guardar historia"}</button>}<button className="btn-sm sec" onClick={imprimir}>🖨 Imprimir</button></div>}
      </div>

      <div style={{ position: "relative", maxWidth: 460, marginBottom: 16 }}>
        <input className="fi" placeholder="🔎 Buscar paciente por nombre o cédula…" value={q} onChange={(e) => { setQ(e.target.value); setAbierto(true); }} onFocus={() => setAbierto(true)} onBlur={() => setTimeout(() => setAbierto(false), 150)} />
        {abierto && sugerencias.length > 0 && (
          <div className="card" style={{ position: "absolute", left: 0, right: 0, top: "100%", marginTop: 4, zIndex: 20, overflow: "hidden" }}>
            {sugerencias.map((p) => <div key={p.id} className="rx-hist-i" style={{ padding: "10px 14px" }} onMouseDown={() => elegir(p)}><div style={{ flex: 1 }}><div className="fw6">{p.nombre}</div><div className="txt-muted mono">{p.cedula || "Sin cédula"}</div></div></div>)}
          </div>
        )}
      </div>
      {msg && <div className="txt-sm fw6" style={{ marginBottom: 12, color: msg.t === "ok" ? "var(--green)" : "var(--rose)" }}>{msg.txt}</div>}

      {!pac ? (
        <div className="card"><div className="empty"><div className="ic">📋</div><div className="t">Elige un paciente</div><div className="s">Busca al paciente para ver sus historias clínicas o abrir una nueva.</div></div></div>
      ) : !f ? (
        <div className="card">
          <div className="card-b" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div><div className="fw6">{pac.nombre}</div><div className="txt-muted">{filas.length} historia{filas.length === 1 ? "" : "s"} registrada{filas.length === 1 ? "" : "s"}</div></div>
            {puedeEscribir && <button className="btn-sm" style={{ marginLeft: "auto" }} onClick={() => setF(formVacio(pac, consultorio, pac.doctor_id))}>+ Nueva historia</button>}
          </div>
          {filas.length === 0 ? <div className="empty"><div className="ic">📋</div><div className="t">Sin historias MSP</div><div className="s">Crea la primera historia clínica única de este paciente.</div></div> : (
            <div className="rx-hist">{filas.map((r) => (
              <div key={r.id} className="rx-hist-i" onClick={() => setF(desdeFila(r))}>
                <div className="no">{fmtFecha(r.fecha, { day: "2-digit", month: "short", year: "numeric" })}</div>
                <div style={{ flex: 1, minWidth: 0 }}><div className="fw6" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.campos?.motivo || "Sin motivo registrado"}</div><div className="txt-muted">{nombreDoc[r.doctor_id] || "Sin doctor"} · {(r.diagnosticos || []).length} diagnóstico(s) · {(r.evolucion || []).length} sesión(es)</div></div>
                <span className="btn-sm sec">Abrir</span>
              </div>))}
            </div>
          )}
        </div>
      ) : (
        <div className="card"><div className="card-b">
          <Sec letra="A" titulo="Establecimiento y paciente">
            <div className="g3">
              <div className="fl"><label>Establecimiento</label><input className="fi sm" value={f.c.establecimiento} onChange={(e) => set("c.establecimiento", e.target.value)} /></div>
              <div className="fl"><label>Código (unicódigo)</label><input className="fi sm mono" value={f.c.unicodigo} onChange={(e) => set("c.unicodigo", e.target.value)} /></div>
              <div className="fl"><label>N.º historia clínica</label><input className="fi sm mono" value={f.c.archivo} onChange={(e) => set("c.archivo", e.target.value)} /></div>
            </div>
            <div className="g3">
              <div className="fl"><label>Paciente</label><input className="fi sm" readOnly value={pac.nombre} /></div>
              <div className="fl"><label>Fecha</label><input className="fi sm" type="date" value={f.fecha} onChange={(e) => set("fecha", e.target.value)} /></div>
              <div className="fl"><label>Profesional</label><select className="fi sm" value={f.doctor_id} onChange={(e) => set("doctor_id", e.target.value)}><option value="">—</option>{doctores.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}</select></div>
            </div>
          </Sec>
          <Sec letra="B" titulo="Motivo de consulta"><textarea className="fi sm" rows={2} placeholder="Escribir en lenguaje del paciente" value={f.c.motivo} onChange={(e) => set("c.motivo", e.target.value)} /></Sec>
          <Sec letra="C" titulo="Enfermedad o problema actual"><textarea className="fi sm" rows={3} value={f.c.enfermedad_actual} onChange={(e) => set("c.enfermedad_actual", e.target.value)} /></Sec>
          <Sec letra="D" titulo="Antecedentes personales y familiares">
            <div className="txt-muted" style={{ marginBottom: 4 }}>Personales</div>
            <div className="ck-grid">{AP.map(([k, l]) => <label key={k} className="ck"><input type="checkbox" checked={f.ap.includes(k)} onChange={() => toggle("ap", k)} />{l}</label>)}</div>
            {f.ap.includes("otro") && <input className="fi sm" style={{ margin: "6px 0" }} placeholder="Especifica" value={f.ap_otro} onChange={(e) => set("ap_otro", e.target.value)} />}
            <div className="txt-muted" style={{ margin: "10px 0 4px" }}>Familiares</div>
            <div className="ck-grid">{AF.map(([k, l]) => <label key={k} className="ck"><input type="checkbox" checked={f.af.includes(k)} onChange={() => toggle("af", k)} />{l}</label>)}</div>
            {f.af.includes("otro") && <input className="fi sm" style={{ marginTop: 6 }} placeholder="Especifica" value={f.af_otro} onChange={(e) => set("af_otro", e.target.value)} />}
          </Sec>
          <Sec letra="E" titulo="Constantes vitales">
            <div className="g3">{[["pa", "Presión arterial"], ["fc", "Frec. cardiaca"], ["fr", "Frec. respiratoria"], ["temp", "Temperatura °C"], ["peso", "Peso (kg)"], ["talla", "Talla (cm)"]].map(([k, l]) => <div key={k} className="fl"><label>{l}</label><input className="fi sm mono" value={f.c.constantes[k]} onChange={(e) => set("c.constantes." + k, e.target.value)} /></div>)}</div>
          </Sec>
          <Sec letra="F" titulo="Examen del sistema estomatognático">
            {EXAMEN.map(([k, l]) => { const e = f.examen[k]; return (
              <div key={k} className="ex-row"><b>{l}</b>
                <div className="seg2"><button type="button" className={e?.estado === "normal" ? "on n" : ""} onClick={() => set("examen." + k, { estado: "normal", obs: e?.obs || "" })}>Normal</button><button type="button" className={e?.estado === "patologico" ? "on p" : ""} onClick={() => set("examen." + k, { estado: "patologico", obs: e?.obs || "" })}>Patológico</button></div>
                <input className="fi sm" placeholder="Descripción" disabled={!e} value={e?.obs || ""} onChange={(x) => set("examen." + k + ".obs", x.target.value)} />
              </div>); })}
          </Sec>
          <Sec letra="G" titulo="Indicadores de salud bucal">
            <div className="txt-muted" style={{ marginBottom: 6 }}>Higiene oral simplificada · placa y cálculo (0–3) por pieza índice</div>
            <div className="hig">{PIEZAS_OHI.map((p) => <div key={p}><b>{p}</b><select className="fi sm" title="Placa" value={f.ind.higiene[p]?.placa ?? ""} onChange={(e) => set("ind.higiene." + p, { ...(f.ind.higiene[p] || {}), placa: e.target.value })}><option value="">Placa</option>{[0, 1, 2, 3].map((n) => <option key={n}>{n}</option>)}</select><select className="fi sm" style={{ marginTop: 4 }} title="Cálculo" value={f.ind.higiene[p]?.calculo ?? ""} onChange={(e) => set("ind.higiene." + p, { ...(f.ind.higiene[p] || {}), calculo: e.target.value })}><option value="">Cálculo</option>{[0, 1, 2, 3].map((n) => <option key={n}>{n}</option>)}</select></div>)}</div>
            <div className="txt-sm fw6" style={{ marginBottom: 12 }}>Índice: placa {ohi.placa.toFixed(2)} + cálculo {ohi.calculo.toFixed(2)} = <span style={{ color: ohi.nivel === "malo" ? "var(--rose)" : ohi.nivel === "bueno" ? "var(--green)" : "var(--amber)" }}>{ohi.total.toFixed(2)} ({ohi.nivel})</span></div>
            <div className="g3">
              <div className="fl"><label>Enfermedad periodontal</label><select className="fi sm" value={f.ind.enf_periodontal} onChange={(e) => set("ind.enf_periodontal", e.target.value)}><option value="">—</option><option>Leve</option><option>Moderada</option><option>Severa</option></select></div>
              <div className="fl"><label>Mal oclusión</label><select className="fi sm" value={f.ind.mal_oclusion} onChange={(e) => set("ind.mal_oclusion", e.target.value)}><option value="">—</option><option>Angle I</option><option>Angle II</option><option>Angle III</option></select></div>
              <div className="fl"><label>Fluorosis</label><select className="fi sm" value={f.ind.fluorosis} onChange={(e) => set("ind.fluorosis", e.target.value)}><option value="">—</option><option>Leve</option><option>Moderada</option><option>Severa</option></select></div>
            </div>
          </Sec>
          <Sec letra="H" titulo="Índices CPO-ceo">
            <div className="cpo" style={{ marginBottom: 8 }}>{["C", "P", "O"].map((k) => <div key={k} className="fl"><label>{k} (perm.)</label><input className="fi sm mono" type="number" min="0" max="32" value={f.c.cpo[k]} onChange={(e) => set("c.cpo." + k, e.target.value)} /></div>)}<div className="tot">CPO-D {num(f.c.cpo.C) + num(f.c.cpo.P) + num(f.c.cpo.O)}</div></div>
            <div className="cpo">{["c", "e", "o"].map((k) => <div key={k} className="fl"><label>{k} (temp.)</label><input className="fi sm mono" type="number" min="0" max="20" value={f.c.cpo[k]} onChange={(e) => set("c.cpo." + k, e.target.value)} /></div>)}<div className="tot">ceo-d {num(f.c.cpo.c) + num(f.c.cpo.e) + num(f.c.cpo.o)}</div></div>
            <div style={{ marginTop: 8 }}><button className="btn-sm sec" type="button" onClick={() => irA && irA("odontograma")}>🦷 Ver odontograma del paciente</button></div>
          </Sec>
          <Sec letra="I" titulo="Diagnósticos (CIE-10)">
            <datalist id="cie10">{CIE10.map((c) => <option key={c.codigo} value={c.codigo}>{c.descripcion}</option>)}</datalist>
            {f.dx.map((x, i) => (
              <div key={i} className="g3" style={{ gridTemplateColumns: "110px 1fr 70px 120px 30px", alignItems: "end" }}>
                <div className="fl"><label>CIE-10</label><input className="fi sm mono" list="cie10" value={x.codigo_cie10} onChange={(e) => { const c = CIE10.find((y) => y.codigo === e.target.value.toUpperCase()); setF((s) => ({ ...s, dx: s.dx.map((d, j) => (j === i ? { ...d, codigo_cie10: e.target.value.toUpperCase(), descripcion: c ? c.descripcion : d.descripcion } : d)) })); }} /></div>
                <div className="fl"><label>Descripción</label><input className="fi sm" value={x.descripcion} onChange={(e) => setF((s) => ({ ...s, dx: s.dx.map((d, j) => (j === i ? { ...d, descripcion: e.target.value } : d)) }))} /></div>
                <div className="fl"><label>Pieza</label><input className="fi sm mono" value={x.pieza} onChange={(e) => setF((s) => ({ ...s, dx: s.dx.map((d, j) => (j === i ? { ...d, pieza: e.target.value } : d)) }))} /></div>
                <div className="fl"><label>Tipo</label><select className="fi sm" value={x.tipo} onChange={(e) => setF((s) => ({ ...s, dx: s.dx.map((d, j) => (j === i ? { ...d, tipo: e.target.value } : d)) }))}><option value="PRE">Presuntivo</option><option value="DEF">Definitivo</option></select></div>
                <button type="button" className="rx-x" onClick={() => setF((s) => ({ ...s, dx: s.dx.filter((_, j) => j !== i) }))}>✕</button>
              </div>))}
            <button className="btn-sm sec" type="button" onClick={() => setF((s) => ({ ...s, dx: [...s.dx, { codigo_cie10: "", descripcion: "", tipo: "PRE", pieza: "" }] }))}>+ Diagnóstico</button>
          </Sec>
          <Sec letra="J" titulo="Plan de tratamiento"><textarea className="fi sm" rows={3} value={f.c.plan_tratamiento} onChange={(e) => set("c.plan_tratamiento", e.target.value)} /></Sec>
          <Sec letra="K" titulo="Evolución y prescripciones">
            {f.evo.map((x, i) => (
              <div key={i} className="card" style={{ marginBottom: 8, background: "var(--bg2)" }}><div className="card-b">
                <div className="g3" style={{ gridTemplateColumns: "90px 150px 1fr 30px", alignItems: "end" }}>
                  <div className="fl"><label>Sesión</label><input className="fi sm mono" value={x.numero_sesion} onChange={(e) => setF((s) => ({ ...s, evo: s.evo.map((d, j) => (j === i ? { ...d, numero_sesion: e.target.value } : d)) }))} /></div>
                  <div className="fl"><label>Fecha</label><input className="fi sm" type="date" value={x.fecha} onChange={(e) => setF((s) => ({ ...s, evo: s.evo.map((d, j) => (j === i ? { ...d, fecha: e.target.value } : d)) }))} /></div>
                  <div className="fl"><label>Firma / responsable</label><input className="fi sm" value={x.firma} onChange={(e) => setF((s) => ({ ...s, evo: s.evo.map((d, j) => (j === i ? { ...d, firma: e.target.value } : d)) }))} /></div>
                  <button type="button" className="rx-x" onClick={() => setF((s) => ({ ...s, evo: s.evo.filter((_, j) => j !== i) }))}>✕</button>
                </div>
                <div className="g3">{[["diagnosticos_complicaciones", "Diagnósticos y complicaciones"], ["procedimientos", "Procedimientos"], ["prescripciones", "Prescripciones"]].map(([k, l]) => <div key={k} className="fl"><label>{l}</label><textarea className="fi sm" rows={2} value={x[k]} onChange={(e) => setF((s) => ({ ...s, evo: s.evo.map((d, j) => (j === i ? { ...d, [k]: e.target.value } : d)) }))} /></div>)}</div>
              </div></div>))}
            <button className="btn-sm sec" type="button" onClick={() => setF((s) => ({ ...s, evo: [...s.evo, { numero_sesion: String(s.evo.length + 1), fecha: hoyISO(), diagnosticos_complicaciones: "", procedimientos: "", prescripciones: "", firma: "" }] }))}>+ Sesión</button>
          </Sec>
          <Sec letra="L" titulo="Consentimiento informado">
            <label className="ck" style={{ marginBottom: 8 }}><input type="checkbox" checked={f.c.consentimiento.aceptado} onChange={(e) => set("c.consentimiento.aceptado", e.target.checked)} />El paciente (o su representante) fue informado y acepta el tratamiento propuesto</label>
            <div className="g2"><div className="fl"><label>Nombre de quien firma</label><input className="fi sm" value={f.c.consentimiento.firmante} onChange={(e) => set("c.consentimiento.firmante", e.target.value)} /></div><div className="fl"><label>Fecha</label><input className="fi sm" type="date" value={f.c.consentimiento.fecha} onChange={(e) => set("c.consentimiento.fecha", e.target.value)} /></div></div>
          </Sec>
        </div></div>
      )}
    </div>
  );
}
