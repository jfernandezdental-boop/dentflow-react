import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { hoyISO, fmtFecha } from "../lib/format";
import "../styles/clinico.css";

const BUCKET = "radiografias";
const TIPOS = [
  { v: "panoramica", label: "Panorámica" },
  { v: "periapical", label: "Periapical" },
  { v: "aleta", label: "Aleta de mordida" },
  { v: "cbct", label: "CBCT / Tomografía" },
  { v: "intraoral", label: "Foto intraoral" },
  { v: "extraoral", label: "Foto extraoral" },
  { v: "otro", label: "Otro" },
];
const TIPO_LABEL = Object.fromEntries(TIPOS.map((t) => [t.v, t.label]));
const MAX_MB = 15;
const esImg = (m) => (m || "").startsWith("image/");
const extDe = (n) => ((n.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin").slice(0, 5);
const mb = (b) => (b / 1048576).toFixed(1) + " MB";

function SubirModal({ open, pacientes, doctores, consultorioId, userId, pacienteInicial, onClose, onDone }) {
  const [files, setFiles] = useState([]);
  const [f, setF] = useState({ paciente_id: "", tipo: "periapical", fecha_toma: hoyISO(), pieza: "", doctor_id: "", notas: "" });
  const [over, setOver] = useState(false);
  const [prog, setProg] = useState(null);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) { setFiles([]); setF({ paciente_id: pacienteInicial || "", tipo: "periapical", fecha_toma: hoyISO(), pieza: "", doctor_id: "", notas: "" }); setError(""); setProg(null); }
  }, [open, pacienteInicial]);
  if (!open) return null;
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  function agregar(list) {
    const ok = [], rechazados = [];
    [...list].forEach((file) => {
      const valido = esImg(file.type) || file.type === "application/pdf";
      if (!valido) rechazados.push(`${file.name}: formato no permitido`);
      else if (file.size > MAX_MB * 1048576) rechazados.push(`${file.name}: supera ${MAX_MB} MB`);
      else ok.push(file);
    });
    setFiles((cur) => [...cur, ...ok].slice(0, 20));
    setError(rechazados.join(" · "));
  }

  async function subir() {
    if (!f.paciente_id) return setError("Selecciona el paciente.");
    if (files.length === 0) return setError("Agrega al menos un archivo.");
    setError("");
    let hechos = 0;
    const fallos = [];
    for (const file of files) {
      setProg({ i: hechos + 1, n: files.length });
      const path = `${consultorioId}/${f.paciente_id}/${crypto.randomUUID()}.${extDe(file.name)}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) { fallos.push(`${file.name}: ${up.error.message}`); continue; }
      const ins = await supabase.from("imagenes_clinicas").insert({
        consultorio_id: consultorioId, paciente_id: f.paciente_id, subido_por: userId, tipo: f.tipo,
        titulo: files.length === 1 ? file.name.replace(/\.[^.]+$/, "") : file.name.replace(/\.[^.]+$/, ""),
        pieza: f.pieza.trim() || null, fecha_toma: f.fecha_toma || null, doctor_id: f.doctor_id || null, notas: f.notas.trim() || null,
        storage_provider: "supabase", storage_path: path, bucket: BUCKET, mime_type: file.type, size_bytes: file.size, activo: true,
      });
      if (ins.error) { await supabase.storage.from(BUCKET).remove([path]); fallos.push(`${file.name}: ${ins.error.message}`); continue; }
      hechos++;
    }
    setProg(null);
    if (fallos.length) { setError("Algunos archivos fallaron — " + fallos.join(" · ")); if (hechos) onDone(false); return; }
    onDone(true);
  }

  return (
    <div className="appt-modal on" onMouseDown={(e) => e.target === e.currentTarget && !prog && onClose()}>
      <div className="appt-box" style={{ width: 560 }}>
        <div className="appt-box-title">📤 Subir imágenes</div>
        <div className="appt-box-sub">Radiografías y fotos clínicas, guardadas de forma privada por clínica</div>

        <div className={"drop" + (over ? " over" : "")} onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); agregar(e.dataTransfer.files); }}>
          <b>Arrastra los archivos aquí o toca para elegir</b>
          JPG, PNG, WebP o PDF · hasta {MAX_MB} MB cada uno · máximo 20
          <input ref={inputRef} type="file" multiple accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => { agregar(e.target.files); e.target.value = ""; }} />
        </div>
        {files.length > 0 && (
          <div className="fl-list">
            {files.map((file, i) => (
              <div key={i} className="fl-row"><span>{esImg(file.type) ? "🖼️" : "📄"}</span><span className="n">{file.name}</span><span className="txt-muted">{mb(file.size)}</span><button type="button" onClick={() => setFiles((c) => c.filter((_, j) => j !== i))}>✕</button></div>
            ))}
          </div>
        )}

        <div className="cg2">
          <div className="fl"><label>Paciente *</label>
            <select className="fi sm" value={f.paciente_id} onChange={(e) => set("paciente_id", e.target.value)}>
              <option value="">Seleccionar…</option>{pacientes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select></div>
          <div className="fl"><label>Tipo</label>
            <select className="fi sm" value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>{TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select></div>
        </div>
        <div className="cg3">
          <div className="fl"><label>Fecha de toma</label><input className="fi sm" type="date" value={f.fecha_toma} onChange={(e) => set("fecha_toma", e.target.value)} /></div>
          <div className="fl"><label>Pieza(s)</label><input className="fi sm mono" placeholder="36, 37" value={f.pieza} onChange={(e) => set("pieza", e.target.value)} /></div>
          <div className="fl"><label>Doctor</label>
            <select className="fi sm" value={f.doctor_id} onChange={(e) => set("doctor_id", e.target.value)}><option value="">—</option>{doctores.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}</select></div>
        </div>
        <div className="fl" style={{ marginBottom: 12 }}><label>Notas</label><textarea className="fi sm" rows={2} placeholder="Hallazgos, indicación del estudio…" value={f.notas} onChange={(e) => set("notas", e.target.value)} /></div>

        {error && <div className="txt-sm" style={{ color: "var(--rose)", marginBottom: 10 }}>{error}</div>}
        <div className="flex gap8" style={{ justifyContent: "flex-end" }}>
          <button className="btn-sm sec" type="button" onClick={onClose} disabled={!!prog}>Cancelar</button>
          <button className="btn-sm" type="button" onClick={subir} disabled={!!prog}>{prog ? `Subiendo ${prog.i} de ${prog.n}…` : `Subir ${files.length || ""} archivo${files.length === 1 ? "" : "s"}`}</button>
        </div>
      </div>
    </div>
  );
}

function Visor({ lista, idx, setIdx, urls, pacientes, doctores, puedeBorrar, onClose, onChanged }) {
  const img = lista[idx];
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  const [inv, setInv] = useState(false);
  const [bri, setBri] = useState(100);
  const [con, setCon] = useState(100);
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setZoom(1); setRot(0); setInv(false); setBri(100); setCon(100); setMsg("");
    setForm(img ? { titulo: img.titulo || "", tipo: img.tipo || "otro", pieza: img.pieza || "", fecha_toma: img.fecha_toma || "", notas: img.notas || "" } : null);
  }, [img?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const k = (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && idx < lista.length - 1) setIdx(idx + 1);
      if (e.key === "ArrowLeft" && idx > 0) setIdx(idx - 1);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [idx, lista.length, onClose, setIdx]);

  if (!img || !form) return null;
  const pac = pacientes.find((p) => p.id === img.paciente_id);
  const doc = doctores.find((d) => d.id === img.doctor_id);
  const url = urls[img.id];

  async function guardar() {
    const { error } = await supabase.from("imagenes_clinicas").update({ titulo: form.titulo.trim() || null, tipo: form.tipo, pieza: form.pieza.trim() || null, fecha_toma: form.fecha_toma || null, notas: form.notas.trim() || null }).eq("id", img.id);
    setMsg(error ? "No se pudo guardar: " + error.message : "Cambios guardados ✓");
    if (!error) onChanged();
  }
  async function descargar() {
    const { data, error } = await supabase.storage.from(img.bucket || BUCKET).createSignedUrl(img.storage_path, 60, { download: true });
    if (error) return setMsg("No se pudo descargar: " + error.message);
    window.open(data.signedUrl, "_blank", "noopener");
  }
  async function borrar() {
    if (!window.confirm("¿Eliminar esta imagen? Se borrará el archivo y no se puede deshacer.")) return;
    const rm = await supabase.storage.from(img.bucket || BUCKET).remove([img.storage_path]);
    if (rm.error) return setMsg("No se pudo borrar el archivo: " + rm.error.message);
    const { error } = await supabase.from("imagenes_clinicas").delete().eq("id", img.id);
    if (error) return setMsg("No se pudo borrar el registro: " + error.message);
    onChanged(true);
  }

  return (
    <div className="vw" role="dialog" aria-label="Visor de imagen">
      <button className="vw-x" type="button" onClick={onClose} aria-label="Cerrar">✕</button>
      <div className="vw-stage">
        {esImg(img.mime_type) && url ? (
          <img alt={img.titulo || "Imagen clínica"} src={url} draggable={false} style={{ transform: `scale(${zoom}) rotate(${rot}deg)`, filter: `brightness(${bri}%) contrast(${con}%) invert(${inv ? 1 : 0})` }} />
        ) : (
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 56 }}>📄</div><div style={{ margin: "8px 0 14px" }}>{img.titulo || "Documento"}</div><button className="btn-sm" type="button" onClick={descargar}>Abrir PDF</button></div>
        )}
        {idx > 0 && <button type="button" className="vw-nav" style={{ left: 14 }} onClick={() => setIdx(idx - 1)} aria-label="Anterior">‹</button>}
        {idx < lista.length - 1 && <button type="button" className="vw-nav" style={{ right: 14 }} onClick={() => setIdx(idx + 1)} aria-label="Siguiente">›</button>}
        {esImg(img.mime_type) && (
          <div className="vw-bar">
            <button type="button" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.25).toFixed(2)))}>−</button>
            <span style={{ fontSize: 12, minWidth: 40, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((z) => Math.min(5, +(z + 0.25).toFixed(2)))}>+</button>
            <button type="button" onClick={() => setRot((r) => (r + 90) % 360)}>⟳ Girar</button>
            <button type="button" onClick={() => setInv((v) => !v)}>◐ Negativo</button>
            <label>☀ <input type="range" min="40" max="220" value={bri} onChange={(e) => setBri(+e.target.value)} /></label>
            <label>◑ <input type="range" min="40" max="260" value={con} onChange={(e) => setCon(+e.target.value)} /></label>
            <button type="button" onClick={() => { setZoom(1); setRot(0); setInv(false); setBri(100); setCon(100); }}>Restablecer</button>
          </div>
        )}
      </div>
      <div className="vw-side">
        <div className="txt-muted" style={{ marginBottom: 4 }}>{idx + 1} de {lista.length}</div>
        <div className="mh-t" style={{ fontSize: 17 }}>{pac?.nombre || "Paciente"}</div>
        <div className="txt-muted" style={{ marginBottom: 14 }}>{TIPO_LABEL[img.tipo] || "Imagen"} · {fmtFecha(img.fecha_toma)}{doc ? ` · ${doc.nombre}` : ""}{img.size_bytes ? ` · ${mb(img.size_bytes)}` : ""}</div>
        <div className="fl" style={{ marginBottom: 10 }}><label>Título</label><input className="fi sm" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
        <div className="cg2">
          <div className="fl"><label>Tipo</label><select className="fi sm" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>{TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select></div>
          <div className="fl"><label>Pieza(s)</label><input className="fi sm mono" value={form.pieza} onChange={(e) => setForm({ ...form, pieza: e.target.value })} /></div>
        </div>
        <div className="fl" style={{ marginBottom: 10 }}><label>Fecha de toma</label><input className="fi sm" type="date" value={form.fecha_toma} onChange={(e) => setForm({ ...form, fecha_toma: e.target.value })} /></div>
        <div className="fl" style={{ marginBottom: 12 }}><label>Notas / hallazgos</label><textarea className="fi sm" rows={4} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
        <div className="flex gap8" style={{ flexWrap: "wrap" }}>
          <button className="btn-sm" type="button" onClick={guardar}>💾 Guardar</button>
          <button className="btn-sm sec" type="button" onClick={descargar}>⬇ Descargar</button>
          {puedeBorrar && <button className="btn-sm danger" type="button" onClick={borrar}>🗑</button>}
        </div>
        {msg && <div className="txt-sm fw6" style={{ marginTop: 10, color: msg.includes("✓") ? "var(--green)" : "var(--rose)" }}>{msg}</div>}
        <div className="txt-muted" style={{ marginTop: 16, lineHeight: 1.5 }}>Atajos: ← → para navegar, Esc para cerrar. Los ajustes de brillo y contraste no modifican el archivo original.</div>
      </div>
    </div>
  );
}

export default function Imagenes() {
  const { profile, rolUi } = useAuth();
  const consultorioId = profile?.consultorio_id || null;
  const puedeSubir = ["admin", "doctor", "recepcionista"].includes(rolUi);
  const puedeBorrar = rolUi === "admin" || rolUi === "doctor";
  const [imgs, setImgs] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [doctores, setDoctores] = useState([]);
  const [urls, setUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [pacFiltro, setPacFiltro] = useState("all");
  const [tipo, setTipo] = useState("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState([]);
  const [subir, setSubir] = useState(false);
  const [visor, setVisor] = useState(null); // índice
  const [comparar, setComparar] = useState(false);

  async function cargar() {
    if (!consultorioId) { setLoading(false); return; }
    const [i, p, d] = await Promise.all([
      supabase.from("imagenes_clinicas").select("*").eq("consultorio_id", consultorioId).eq("activo", true).order("fecha_toma", { ascending: false }).order("created_at", { ascending: false }).limit(300),
      supabase.from("pacientes").select("id,nombre").eq("consultorio_id", consultorioId).eq("activo", true).order("nombre"),
      supabase.from("doctores").select("id,nombre").eq("consultorio_id", consultorioId).order("nombre"),
    ]);
    if (i.error) setErrorCarga(i.error.message);
    const lista = i.data || [];
    setImgs(lista); setPacientes(p.data || []); setDoctores(d.data || []); setLoading(false);
    const paths = lista.filter((x) => esImg(x.mime_type)).map((x) => x.storage_path);
    if (paths.length) {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
      const porPath = Object.fromEntries((data || []).filter((r) => r.signedUrl).map((r) => [r.path, r.signedUrl]));
      setUrls(Object.fromEntries(lista.filter((x) => porPath[x.storage_path]).map((x) => [x.id, porPath[x.storage_path]])));
    } else setUrls({});
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [consultorioId]);

  const nombrePac = useMemo(() => Object.fromEntries(pacientes.map((p) => [p.id, p.nombre])), [pacientes]);
  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return imgs.filter((x) => {
      if (pacFiltro !== "all" && x.paciente_id !== pacFiltro) return false;
      if (tipo !== "all" && x.tipo !== tipo) return false;
      if (!t) return true;
      return [nombrePac[x.paciente_id], x.titulo, x.pieza, x.notas].some((s) => (s || "").toLowerCase().includes(t));
    });
  }, [imgs, pacFiltro, tipo, q, nombrePac]);
  const conteoTipo = useMemo(() => { const c = {}; imgs.forEach((x) => { c[x.tipo] = (c[x.tipo] || 0) + 1; }); return c; }, [imgs]);

  const toggleSel = (id, e) => { e.stopPropagation(); setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(-2))); };
  const seleccionadas = sel.map((id) => imgs.find((x) => x.id === id)).filter(Boolean);

  if (!consultorioId) return <div className="pgm"><div className="card"><div className="empty"><div className="ic">🏥</div><div className="t">Sin clínica asociada</div></div></div></div>;

  return (
    <div className="pgm">
      <div className="mh">
        <div>
          <div className="mh-t">🖼️ Imágenes clínicas</div>
          <div className="mh-s">Radiografías, tomografías y fotografías por paciente, con visor, brillo/contraste y comparación</div>
        </div>
        <div className="mh-a">
          {seleccionadas.length === 2 && <button className="btn-sm sec" onClick={() => setComparar(true)}>⇆ Comparar (2)</button>}
          {sel.length > 0 && <button className="btn-sm sec" onClick={() => setSel([])}>Limpiar selección</button>}
          {puedeSubir && <button className="btn-sm" onClick={() => setSubir(true)}>+ Subir imágenes</button>}
        </div>
      </div>

      <div className="toolbar">
        <div className="search"><input className="fi sm" placeholder="Buscar paciente, título, pieza o nota…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="fi sm" style={{ width: "auto", maxWidth: 240 }} value={pacFiltro} onChange={(e) => setPacFiltro(e.target.value)}>
          <option value="all">Todos los pacientes</option>{pacientes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>
      <div className="toolbar" style={{ marginTop: -4 }}>
        <div className="chips">
          <button type="button" className={"chip" + (tipo === "all" ? " on" : "")} onClick={() => setTipo("all")}>Todas<span className="n">{imgs.length}</span></button>
          {TIPOS.filter((t) => conteoTipo[t.v]).map((t) => <button key={t.v} type="button" className={"chip" + (tipo === t.v ? " on" : "")} onClick={() => setTipo(t.v)}>{t.label}<span className="n">{conteoTipo[t.v]}</span></button>)}
        </div>
      </div>
      {sel.length === 1 && <div className="txt-muted" style={{ marginBottom: 10 }}>Elige una segunda imagen para compararlas lado a lado.</div>}
      {errorCarga && <div className="card mb14"><div className="card-b txt-sm" style={{ color: "var(--rose)" }}>No se pudieron cargar las imágenes: {errorCarga}</div></div>}

      {loading ? (
        <div className="gal">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="sk" style={{ height: 220 }} />)}</div>
      ) : visibles.length === 0 ? (
        <div className="card"><div className="empty"><div className="ic">🖼️</div><div className="t">{imgs.length ? "Sin resultados" : "Aún no hay imágenes"}</div><div className="s">{imgs.length ? "Prueba con otros filtros." : "Sube radiografías o fotos clínicas de tus pacientes. Se guardan de forma privada y solo las ve tu equipo."}</div>{puedeSubir && !imgs.length && <button className="btn-sm" onClick={() => setSubir(true)}>+ Subir la primera imagen</button>}</div></div>
      ) : (
        <div className="gal">
          {visibles.map((x, i) => (
            <div key={x.id} className={"gal-i" + (sel.includes(x.id) ? " sel" : "")} onClick={() => setVisor(i)}>
              <div className="gal-th">
                {urls[x.id] ? <img src={urls[x.id]} alt={x.titulo || "Imagen"} loading="lazy" /> : esImg(x.mime_type) ? "🖼️" : "📄"}
                <span className="gal-tp">{TIPO_LABEL[x.tipo] || "Imagen"}</span>
                <span className="gal-ck" onClick={(e) => toggleSel(x.id, e)} title="Seleccionar para comparar">{sel.includes(x.id) ? "✓" : ""}</span>
              </div>
              <div className="gal-m">
                <div className="p">{nombrePac[x.paciente_id] || "Paciente"}</div>
                <div className="s">{fmtFecha(x.fecha_toma, { day: "2-digit", month: "short", year: "numeric" })}{x.pieza ? ` · pieza ${x.pieza}` : ""}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && imgs.length >= 300 && <div className="txt-muted" style={{ textAlign: "center", padding: 14 }}>Mostrando las 300 imágenes más recientes. Filtra por paciente para ver más.</div>}

      <SubirModal open={subir} pacientes={pacientes} doctores={doctores} consultorioId={consultorioId} userId={profile?.id} pacienteInicial={pacFiltro !== "all" ? pacFiltro : ""} onClose={() => setSubir(false)} onDone={(ok) => { if (ok) setSubir(false); cargar(); }} />
      {visor !== null && <Visor lista={visibles} idx={Math.min(visor, visibles.length - 1)} setIdx={setVisor} urls={urls} pacientes={pacientes} doctores={doctores} puedeBorrar={puedeBorrar} onClose={() => setVisor(null)} onChanged={(borrada) => { if (borrada) setVisor(null); cargar(); }} />}
      {comparar && seleccionadas.length === 2 && (
        <div className="cmp" onClick={() => setComparar(false)}>
          {seleccionadas.map((x) => (
            <div key={x.id}>
              {urls[x.id] ? <img src={urls[x.id]} alt={x.titulo || "Imagen"} /> : <div style={{ fontSize: 48 }}>📄</div>}
              <div className="cap"><b>{nombrePac[x.paciente_id]}</b><br />{TIPO_LABEL[x.tipo]} · {fmtFecha(x.fecha_toma)}{x.pieza ? ` · pieza ${x.pieza}` : ""}</div>
            </div>
          ))}
          <button className="vw-x" type="button" onClick={() => setComparar(false)}>✕</button>
        </div>
      )}
    </div>
  );
}
