import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { FacturarModal, AbonoModal } from "../components/CobroModales";
import "../styles/clinico.css";

const ESTADOS = [
  { v: "pendiente", label: "Pendiente", tag: "ta" },
  { v: "aceptado", label: "Aceptado", tag: "tg" },
  { v: "cobrado", label: "Cobrado", tag: "tb" },
];
function estadoInfo(v) {
  return ESTADOS.find((e) => e.v === v) || ESTADOS[0];
}
function fmt(n) {
  return "$" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function itemNeto(it) {
  return (it.precio || 0) * (1 - (it.descuento || 0) / 100);
}

function PresupuestoForm({ presupuestoId, consultorioId, pacientes, doctores, catalogo, onVolver, onGuardado }) {
  const [pacienteId, setPacienteId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [descuentoGlobal, setDescuentoGlobal] = useState(0);
  const [observaciones, setObservaciones] = useState(
    "El presupuesto tiene vigencia de 30 días. Una vez expirado, debe ser reevaluado por el profesional."
  );
  const [estado, setEstado] = useState("pendiente");
  const [items, setItems] = useState([]);
  const [manualNombre, setManualNombre] = useState("");
  const [manualPieza, setManualPieza] = useState("");
  const [manualPrecio, setManualPrecio] = useState("");
  const [buscarCatalogo, setBuscarCatalogo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      if (!presupuestoId) {
        setItems([]);
        return;
      }
      const [{ data: p }, { data: its }] = await Promise.all([
        supabase.from("presupuestos").select("*").eq("id", presupuestoId).single(),
        supabase.from("presupuesto_items").select("*").eq("presupuesto_id", presupuestoId).order("created_at"),
      ]);
      if (p) {
        setPacienteId(p.paciente_id || "");
        setDoctorId(p.doctor_id || "");
        setDescuentoGlobal(p.descuento_pct || 0);
        setObservaciones(p.observaciones || "");
        setEstado(p.estado || "pendiente");
      }
      setItems((its || []).map((it) => ({ _key: it.id, procedimiento_id: it.procedimiento_id, nombre: it.nombre, pieza: it.pieza || "", precio: it.precio, descuento: it.descuento || 0 })));
    })();
  }, [presupuestoId]);

  const subtotal = useMemo(() => items.reduce((s, i) => s + (i.precio || 0), 0), [items]);
  const neto = useMemo(() => items.reduce((s, i) => s + itemNeto(i), 0), [items]);
  const descuentoItems = subtotal - neto;
  const total = neto * (1 - (parseFloat(descuentoGlobal) || 0) / 100);

  function agregarDelCatalogo(proc) {
    setItems((prev) => [...prev, { _key: crypto.randomUUID(), procedimiento_id: proc.id, nombre: proc.nombre, pieza: "", precio: Number(proc.precio_base) || 0, descuento: 0 }]);
  }
  function agregarManual() {
    if (!manualNombre.trim() || !manualPrecio) return;
    setItems((prev) => [...prev, { _key: crypto.randomUUID(), procedimiento_id: null, nombre: manualNombre.trim(), pieza: manualPieza, precio: parseFloat(manualPrecio) || 0, descuento: 0 }]);
    setManualNombre("");
    setManualPieza("");
    setManualPrecio("");
  }
  function quitarItem(key) {
    setItems((prev) => prev.filter((i) => i._key !== key));
  }
  function actualizarItem(key, campo, valor) {
    setItems((prev) => prev.map((i) => (i._key === key ? { ...i, [campo]: valor } : i)));
  }

  const catalogoFiltrado = useMemo(() => {
    if (!buscarCatalogo) return catalogo;
    const q = buscarCatalogo.toLowerCase();
    return catalogo.filter((p) => p.nombre.toLowerCase().includes(q));
  }, [catalogo, buscarCatalogo]);

  async function guardar() {
    if (!pacienteId || !doctorId) {
      setError("Selecciona paciente y doctor.");
      return;
    }
    if (items.length === 0) {
      setError("Agrega al menos un tratamiento.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      paciente_id: pacienteId,
      doctor_id: doctorId,
      descuento_pct: parseFloat(descuentoGlobal) || 0,
      observaciones: observaciones || null,
      estado,
    };
    let pid = presupuestoId;
    if (pid) {
      const { error: e1 } = await supabase.from("presupuestos").update(payload).eq("id", pid);
      if (e1) { setSaving(false); setError("No se pudo guardar: " + e1.message); return; }
      await supabase.from("presupuesto_items").delete().eq("presupuesto_id", pid);
    } else {
      payload.consultorio_id = consultorioId;
      payload.fecha = new Date().toISOString().slice(0, 10);
      const { data, error: e1 } = await supabase.from("presupuestos").insert(payload).select("id").single();
      if (e1) { setSaving(false); setError("No se pudo crear: " + e1.message); return; }
      pid = data.id;
    }
    const itemsPayload = items.map((i) => ({
      presupuesto_id: pid,
      procedimiento_id: i.procedimiento_id,
      nombre: i.nombre,
      pieza: i.pieza ? parseInt(i.pieza, 10) : null,
      precio: i.precio,
      descuento: i.descuento || 0,
      tipo: "tratamiento",
    }));
    const { error: e2 } = await supabase.from("presupuesto_items").insert(itemsPayload);
    setSaving(false);
    if (e2) { setError("Se guardó el presupuesto pero no los ítems: " + e2.message); return; }
    onGuardado();
  }

  return (
    <div>
      <div className="flex items-c jc-b mb18">
        <div>
          <div className="fw7" style={{ fontSize: 15 }}>{presupuestoId ? "Editar presupuesto" : "Nuevo presupuesto"}</div>
          <div className="txt-muted">Vigencia 30 días · Debe ser reevaluado al vencer</div>
        </div>
        <div className="flex gap8 items-c">
          <button className="btn-sm sec" onClick={onVolver}>← Volver al listado</button>
          <button className="btn-sm" onClick={guardar} disabled={saving}>{saving ? "Guardando…" : "💾 Guardar proforma"}</button>
        </div>
      </div>

      <div className="budget-layout">
        <div className="budget-form">
          <div className="bf-header">
            <div>
              <div className="bf-htitle">PROFORMA</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.45)", marginTop: 2 }}>
                {presupuestoId ? "Editando" : "Sin número · borrador"}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="bf-hbadge">{new Date().toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" })}</div>
              {presupuestoId && (
                <div style={{ marginTop: 6 }}>
                  <span className={"tag " + estadoInfo(estado).tag}>{estadoInfo(estado).label}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bf-meta">
            <div className="fl">
              <label>Paciente</label>
              <select className="fi sm" value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}>
                <option value="">Selecciona…</option>
                {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div className="fl">
              <label>Doctor</label>
              <select className="fi sm" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                <option value="">Selecciona…</option>
                {doctores.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
            </div>
            {presupuestoId && (
              <div className="fl">
                <label>Estado</label>
                <select className="fi sm" value={estado} onChange={(e) => setEstado(e.target.value)}>
                  {ESTADOS.map((e2) => <option key={e2.v} value={e2.v}>{e2.label}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="bf-section">
            <div className="bf-section-title">
              <span>TRATAMIENTOS PRESUPUESTADOS</span>
              <span className="txt-muted" style={{ fontSize: 11, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                Elige del catálogo a la derecha o agrega uno manual
              </span>
            </div>
            <div className="bf-items">
              {items.length === 0 && <div className="txt-muted txt-sm" style={{ padding: "10px 0" }}>Sin tratamientos agregados.</div>}
              {items.map((it) => (
                <div key={it._key} className="flex gap8 items-c" style={{ padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                  <input className="fi sm" style={{ flex: 1, background: "#fff" }} value={it.nombre} onChange={(e) => actualizarItem(it._key, "nombre", e.target.value)} />
                  <input className="fi sm mono" style={{ width: 60, background: "#fff" }} placeholder="Pieza" value={it.pieza} onChange={(e) => actualizarItem(it._key, "pieza", e.target.value)} />
                  <input className="fi sm mono" type="number" style={{ width: 90, background: "#fff" }} value={it.precio} onChange={(e) => actualizarItem(it._key, "precio", parseFloat(e.target.value) || 0)} />
                  <input className="fi sm mono" type="number" style={{ width: 60, background: "#fff" }} title="Descuento %" value={it.descuento} onChange={(e) => actualizarItem(it._key, "descuento", parseFloat(e.target.value) || 0)} />
                  <span className="mono txt-sm" style={{ width: 80, textAlign: "right", color: "rgba(255,255,255,.85)" }}>{fmt(itemNeto(it))}</span>
                  <button className="icon-btn" style={{ background: "transparent", border: "none" }} onClick={() => quitarItem(it._key)}>🗑</button>
                </div>
              ))}
            </div>
            <div className="add-item-bar mt8">
              <input className="fi sm" placeholder="Procedimiento manual" style={{ background: "#fff" }} value={manualNombre} onChange={(e) => setManualNombre(e.target.value)} />
              <input className="fi sm" placeholder="🦷 Pieza" style={{ background: "#fff", minWidth: 80 }} value={manualPieza} onChange={(e) => setManualPieza(e.target.value)} />
              <input className="fi sm mono" type="number" placeholder="Precio" style={{ background: "#fff", width: 100 }} value={manualPrecio} onChange={(e) => setManualPrecio(e.target.value)} />
              <button className="btn-add-item" onClick={agregarManual}>+ Agregar</button>
            </div>
          </div>

          <div className="bf-totals">
            <div className="bf-tot-row"><span>Subtotal tratamientos</span><span className="mono">{fmt(subtotal)}</span></div>
            {descuentoItems > 0.001 && (
              <div className="bf-tot-row"><span>Descuentos por ítem</span><span className="mono">-{fmt(descuentoItems)}</span></div>
            )}
            <div className="bf-tot-row">
              <span>Descuento</span>
              <span className="flex gap8 items-c">
                <input className="fi sm mono" type="number" min="0" max="100" style={{ width: 60, textAlign: "right" }} value={descuentoGlobal} onChange={(e) => setDescuentoGlobal(e.target.value)} /> %
              </span>
            </div>
            <div className="bf-tot-row"><span style={{ color: "rgba(255,255,255,.7)" }}>TOTAL PRESUPUESTO</span><span className="mono">{fmt(total)}</span></div>
          </div>

          <div className="bf-obs">
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", display: "block", marginBottom: 6 }}>Observaciones</label>
            <textarea className="fi" rows={3} style={{ resize: "vertical" }} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </div>

          {error && <div className="txt-sm" style={{ color: "#ffb4bd", padding: "8px 0" }}>{error}</div>}
        </div>

        <div className="budget-side">
          <div className="flex items-c jc-b mb8">
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>📋 Catálogo de tratamientos</div>
          </div>
          <input className="fi sm mb8" placeholder="Buscar…" value={buscarCatalogo} onChange={(e) => setBuscarCatalogo(e.target.value)} />
          <div id="catalogContainer">
            {catalogoFiltrado.map((p) => (
              <div key={p.id} className="flex items-c jc-b" style={{ padding: "8px 4px", borderBottom: "1px solid var(--border)", cursor: "pointer" }} onClick={() => agregarDelCatalogo(p)}>
                <div>
                  <div className="txt-sm fw6">{p.nombre}</div>
                  {p.categoria && <div className="txt-muted" style={{ fontSize: 11 }}>{p.categoria}</div>}
                </div>
                <div className="flex gap8 items-c">
                  <span className="mono txt-sm">{fmt(p.precio_base)}</span>
                  <span style={{ color: "var(--teal)" }}>➕</span>
                </div>
              </div>
            ))}
            {catalogoFiltrado.length === 0 && <div className="txt-muted txt-sm" style={{ padding: 10 }}>Sin resultados.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Presupuesto() {
  const { profile, rolUi } = useAuth();
  const puedeCobrar = rolUi === "admin" || rolUi === "recepcionista";
  const consultorioId = profile?.consultorio_id || null;
  const [vista, setVista] = useState("lista"); // 'lista' | 'form'
  const [editandoId, setEditandoId] = useState(null);
  const [presupuestos, setPresupuestos] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [doctores, setDoctores] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [cargosPres, setCargosPres] = useState({});
  const [facturar, setFacturar] = useState(null);
  const [abonar, setAbonar] = useState(null);
  const [aviso, setAviso] = useState("");

  async function cargar() {
    if (!consultorioId) { setLoading(false); return; }
    setLoading(true);
    const [{ data: ps }, { data: its }, { data: pac }, { data: doc }, { data: cat }, { data: cgs }] = await Promise.all([
      supabase.from("presupuestos").select("*, pacientes(nombre), doctores(nombre)").eq("consultorio_id", consultorioId).order("created_at", { ascending: false }),
      supabase.from("presupuesto_items").select("presupuesto_id,precio,descuento"),
      supabase.from("pacientes").select("id,nombre").eq("consultorio_id", consultorioId).eq("activo", true).order("nombre"),
      supabase.from("doctores").select("id,nombre").eq("consultorio_id", consultorioId).eq("activo", true).order("nombre"),
      supabase.from("procedimientos").select("id,nombre,precio_base,categoria").eq("consultorio_id", consultorioId).eq("activo", true).order("nombre"),
      supabase.from("cargos").select("id,total,presupuesto_id,procedimiento,pacientes(nombre),abonos(monto)").eq("consultorio_id", consultorioId).not("presupuesto_id", "is", null),
    ]);
    setCargosPres(Object.fromEntries((cgs || []).map((c) => [c.presupuesto_id, { ...c, pagado: (c.abonos || []).reduce((s, a) => s + Number(a.monto || 0), 0) }])));
    const totalesPorPresupuesto = {};
    (its || []).forEach((it) => {
      const neto = (it.precio || 0) * (1 - (it.descuento || 0) / 100);
      totalesPorPresupuesto[it.presupuesto_id] = (totalesPorPresupuesto[it.presupuesto_id] || 0) + neto;
    });
    const conTotal = (ps || []).map((p) => ({
      ...p,
      _total: (totalesPorPresupuesto[p.id] || 0) * (1 - (p.descuento_pct || 0) / 100),
    }));
    setPresupuestos(conTotal);
    setPacientes(pac || []);
    setDoctores(doc || []);
    setCatalogo(cat || []);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultorioId]);

  const filtrados = useMemo(() => presupuestos.filter((p) => !filtroEstado || p.estado === filtroEstado), [presupuestos, filtroEstado]);

  function abrirNuevo() {
    setEditandoId(null);
    setVista("form");
  }
  function abrirEditar(p) {
    setEditandoId(p.id);
    setVista("form");
  }
  async function alGuardar() {
    setVista("lista");
    await cargar();
  }

  if (vista === "form") {
    return (
      <div style={{ padding: 28 }}>
        <PresupuestoForm
          presupuestoId={editandoId}
          consultorioId={consultorioId}
          pacientes={pacientes}
          doctores={doctores}
          catalogo={catalogo}
          onVolver={() => setVista("lista")}
          onGuardado={alGuardar}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 28 }}>
      <div className="flex items-c jc-b mb14">
        <div className="fw7" style={{ fontSize: 16 }}>💰 Presupuestos</div>
        <button className="btn-sm" onClick={abrirNuevo}>+ Nuevo presupuesto</button>
      </div>

      <div className="cal-view-toggle mb14" role="tablist">
        <button type="button" className={"cvt-btn" + (filtroEstado === "" ? " on" : "")} onClick={() => setFiltroEstado("")}>Todos</button>
        {ESTADOS.map((e) => (
          <button key={e.v} type="button" className={"cvt-btn" + (filtroEstado === e.v ? " on" : "")} onClick={() => setFiltroEstado(e.v)}>{e.label}</button>
        ))}
      </div>

      <div className="tw">
        <table>
          <thead>
            <tr><th>Paciente</th><th>Doctor</th><th>Fecha</th><th>Total</th><th>Estado</th><th>Cobro</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="txt-muted" style={{ padding: 20 }}>Cargando…</td></tr>}
            {!loading && filtrados.length === 0 && <tr><td colSpan={6} className="txt-muted" style={{ padding: 20 }}>Sin presupuestos para este filtro.</td></tr>}
            {!loading && filtrados.map((p) => (
              <tr key={p.id} onClick={() => abrirEditar(p)} style={{ cursor: "pointer" }}>
                <td className="fw6">{p.pacientes?.nombre || "?"}</td>
                <td>{p.doctores?.nombre || "?"}</td>
                <td>{p.fecha}</td>
                <td className="mono">{fmt(p._total)}</td>
                <td><span className={"tag " + estadoInfo(p.estado).tag}>{estadoInfo(p.estado).label}</span></td>
                <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: "nowrap" }}>
                  {cargosPres[p.id] ? (
                    <span className="txt-sm">
                      <span className="mono fw6" style={{ color: cargosPres[p.id].total - cargosPres[p.id].pagado > 0.01 ? "var(--rose)" : "var(--green)" }}>
                        {cargosPres[p.id].total - cargosPres[p.id].pagado > 0.01 ? "Saldo " + fmt(cargosPres[p.id].total - cargosPres[p.id].pagado) : "Pagado ✓"}
                      </span>{" "}
                      {puedeCobrar && cargosPres[p.id].total - cargosPres[p.id].pagado > 0.01 && <button className="btn-sm" type="button" onClick={() => setAbonar(cargosPres[p.id])}>💵 Abonar</button>}
                    </span>
                  ) : puedeCobrar && p._total > 0 ? (
                    <button className="btn-sm" type="button" onClick={() => setFacturar(p)}>💳 Facturar y cobrar</button>
                  ) : <span className="txt-muted">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {aviso && <div className="txt-sm fw6 mt14" style={{ color: "var(--teal)" }}>{aviso}</div>}
      {facturar && <FacturarModal presupuesto={facturar} consultorioId={consultorioId} userId={profile?.id} onClose={() => setFacturar(null)} onSaved={() => { setFacturar(null); setAviso("✓ Presupuesto facturado. Puedes ver el cargo en Contabilidad → Pagos."); cargar(); }} />}
      {abonar && <AbonoModal cargo={abonar} pagado={abonar.pagado} userId={profile?.id} onClose={() => setAbonar(null)} onSaved={() => { setAbonar(null); setAviso("✓ Abono registrado."); cargar(); }} />}

      <div className="card mt14">
        <div className="card-b txt-sm txt-muted">
          🚧 Próximamente: exportar la proforma a PDF.
        </div>
      </div>
    </div>
  );
}
