import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { hoyISO } from "../lib/format";
import { METODOS, redondear, sincronizarPresupuesto } from "../lib/cobros";

const usd = (n) => "$" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Marco({ titulo, sub, ancho = 520, onClose, ocupado, children }) {
  return (
    <div className="appt-modal on" onMouseDown={(e) => e.target === e.currentTarget && !ocupado && onClose()}>
      <div className="appt-box" style={{ width: ancho }}>
        <div className="appt-box-title">{titulo}</div>
        {sub && <div className="appt-box-sub">{sub}</div>}
        {children}
      </div>
    </div>
  );
}

function CamposPago({ pago, setPago, max }) {
  return (
    <>
      <div className="cg2">
        <div className="fl"><label>Monto (USD) *</label><input className="fi sm mono" type="number" min="0" step="0.01" max={max} value={pago.monto} onChange={(e) => setPago({ ...pago, monto: e.target.value })} /></div>
        <div className="fl"><label>Método de pago</label><select className="fi sm" value={pago.metodo} onChange={(e) => setPago({ ...pago, metodo: e.target.value })}>{METODOS.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}</select></div>
      </div>
      <div className="cg2">
        <div className="fl"><label>Fecha del pago</label><input className="fi sm" type="date" value={pago.fecha} onChange={(e) => setPago({ ...pago, fecha: e.target.value })} /></div>
        <div className="fl"><label>Observaciones</label><input className="fi sm" placeholder="N.º de transferencia, cheque…" value={pago.observaciones} onChange={(e) => setPago({ ...pago, observaciones: e.target.value })} /></div>
      </div>
    </>
  );
}

// ── Registrar un abono sobre un cargo existente ──
export function AbonoModal({ cargo, pagado, userId, onClose, onSaved }) {
  const saldo = redondear(Number(cargo.total) - Number(pagado || 0));
  const [pago, setPago] = useState({ monto: String(saldo), metodo: "efectivo", fecha: hoyISO(), observaciones: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function guardar() {
    const monto = redondear(pago.monto);
    if (!(monto > 0)) return setError("El monto debe ser mayor a 0.");
    if (monto > saldo + 0.005) return setError(`El abono no puede superar el saldo pendiente (${usd(saldo)}).`);
    setSaving(true); setError("");
    const { error: err } = await supabase.from("abonos").insert({ cargo_id: cargo.id, monto, metodo: pago.metodo, fecha: pago.fecha, observaciones: pago.observaciones.trim() || null, creado_por: userId || null });
    if (err) { setSaving(false); return setError("No se pudo registrar el abono: " + err.message); }
    await sincronizarPresupuesto(cargo.id);
    setSaving(false);
    onSaved();
  }
  return (
    <Marco titulo="💵 Registrar abono" sub={`${cargo.pacientes?.nombre || "Paciente"} · ${cargo.procedimiento || "Cargo"}`} onClose={onClose} ocupado={saving}>
      <div className="kpi-row" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 14 }}>
        <div className="kpi t" style={{ margin: 0 }}><div className="kpi-l">Total</div><div className="kpi-v" style={{ fontSize: 18 }}>{usd(cargo.total)}</div></div>
        <div className="kpi g" style={{ margin: 0 }}><div className="kpi-l">Pagado</div><div className="kpi-v" style={{ fontSize: 18 }}>{usd(pagado)}</div></div>
        <div className="kpi r" style={{ margin: 0 }}><div className="kpi-l">Saldo</div><div className="kpi-v" style={{ fontSize: 18 }}>{usd(saldo)}</div></div>
      </div>
      <CamposPago pago={pago} setPago={setPago} max={saldo} />
      {error && <div className="txt-sm" style={{ color: "var(--rose)", marginBottom: 10 }}>{error}</div>}
      <div className="flex gap8" style={{ justifyContent: "flex-end" }}>
        <button className="btn-sm sec" type="button" onClick={onClose} disabled={saving}>Cancelar</button>
        <button className="btn-sm" type="button" onClick={guardar} disabled={saving}>{saving ? "Guardando…" : "💾 Registrar abono"}</button>
      </div>
    </Marco>
  );
}

// ── Facturar un presupuesto (crea el cargo) y, si se desea, cobrar en el acto ──
export function FacturarModal({ presupuesto, consultorioId, userId, onClose, onSaved }) {
  const total = redondear(presupuesto._total);
  const [proc, setProc] = useState("");
  const [cobrarAhora, setCobrarAhora] = useState(true);
  const [pago, setPago] = useState({ monto: String(total), metodo: "efectivo", fecha: hoyISO(), observaciones: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("presupuesto_items").select("nombre,pieza").eq("presupuesto_id", presupuesto.id).then(({ data }) => {
      const t = (data || []).map((i) => i.nombre + (i.pieza ? ` (${i.pieza})` : "")).join("; ");
      setProc((t || "Presupuesto").slice(0, 240));
    });
  }, [presupuesto.id]);

  async function confirmar() {
    if (!(total > 0)) return setError("Este presupuesto no tiene monto para facturar.");
    if (!proc.trim()) return setError("Escribe el concepto del cargo.");
    const monto = redondear(pago.monto);
    if (cobrarAhora && (!(monto > 0) || monto > total + 0.005)) return setError(`El pago debe estar entre $0.01 y ${usd(total)}.`);
    setSaving(true); setError("");
    const ya = await supabase.from("cargos").select("id").eq("presupuesto_id", presupuesto.id).limit(1);
    if (ya.data?.length) { setSaving(false); return setError("Este presupuesto ya fue facturado. Registra el cobro desde su cargo."); }
    const c = await supabase.from("cargos").insert({ consultorio_id: consultorioId, paciente_id: presupuesto.paciente_id, doctor_id: presupuesto.doctor_id || null, presupuesto_id: presupuesto.id, procedimiento: proc.trim(), total, fecha: hoyISO(), creado_por: userId || null }).select("id").single();
    if (c.error) { setSaving(false); return setError("No se pudo crear el cargo: " + c.error.message); }
    if (presupuesto.estado === "pendiente") await supabase.from("presupuestos").update({ estado: "aceptado" }).eq("id", presupuesto.id);
    if (cobrarAhora) {
      const a = await supabase.from("abonos").insert({ cargo_id: c.data.id, monto, metodo: pago.metodo, fecha: pago.fecha, observaciones: pago.observaciones.trim() || null, creado_por: userId || null });
      if (a.error) { setSaving(false); return setError("El cargo se creó, pero no se pudo registrar el pago: " + a.error.message + ". Regístralo desde Contabilidad → Pagos."); }
    }
    await sincronizarPresupuesto(c.data.id);
    setSaving(false);
    onSaved();
  }

  return (
    <Marco titulo="💳 Facturar y cobrar" sub={`${presupuesto.pacientes?.nombre || "Paciente"} · proforma del ${presupuesto.fecha}`} ancho={540} onClose={onClose} ocupado={saving}>
      <div className="kpi t" style={{ margin: "0 0 14px" }}><div className="kpi-l">Total a facturar</div><div className="kpi-v">{usd(total)}</div></div>
      <div className="fl" style={{ marginBottom: 12 }}><label>Concepto del cargo</label><input className="fi sm" value={proc} onChange={(e) => setProc(e.target.value)} /></div>
      <label className="ck" style={{ marginBottom: 8 }}><input type="checkbox" checked={cobrarAhora} onChange={(e) => setCobrarAhora(e.target.checked)} />Registrar un pago ahora</label>
      {cobrarAhora && <CamposPago pago={pago} setPago={setPago} max={total} />}
      <div className="txt-muted" style={{ marginBottom: 12 }}>Se creará un cargo por {usd(total)}{cobrarAhora && redondear(pago.monto) > 0 ? ` y un abono de ${usd(redondear(pago.monto))}` : ""}. Si queda pagado por completo, el presupuesto pasa a «Cobrado».</div>
      {error && <div className="txt-sm" style={{ color: "var(--rose)", marginBottom: 10 }}>{error}</div>}
      <div className="flex gap8" style={{ justifyContent: "flex-end" }}>
        <button className="btn-sm sec" type="button" onClick={onClose} disabled={saving}>Cancelar</button>
        <button className="btn-sm" type="button" onClick={confirmar} disabled={saving}>{saving ? "Procesando…" : "✓ Confirmar"}</button>
      </div>
    </Marco>
  );
}

// ── Cargo manual (sin presupuesto), con pago inicial opcional ──
export function CargoManualModal({ consultorioId, userId, onClose, onSaved }) {
  const [pacientes, setPacientes] = useState([]);
  const [doctores, setDoctores] = useState([]);
  const [f, setF] = useState({ paciente_id: "", doctor_id: "", procedimiento: "", total: "", fecha: hoyISO() });
  const [cobrarAhora, setCobrarAhora] = useState(false);
  const [pago, setPago] = useState({ monto: "", metodo: "efectivo", fecha: hoyISO(), observaciones: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("pacientes").select("id,nombre").eq("consultorio_id", consultorioId).eq("activo", true).order("nombre").then(({ data }) => setPacientes(data || []));
    supabase.from("doctores").select("id,nombre").eq("consultorio_id", consultorioId).eq("activo", true).order("nombre").then(({ data }) => setDoctores(data || []));
  }, [consultorioId]);

  async function guardar() {
    const total = redondear(f.total), monto = redondear(pago.monto);
    if (!f.paciente_id) return setError("Selecciona el paciente.");
    if (!f.procedimiento.trim()) return setError("Escribe el concepto del cargo.");
    if (!(total > 0)) return setError("El total debe ser mayor a 0.");
    if (cobrarAhora && (!(monto > 0) || monto > total + 0.005)) return setError(`El pago debe estar entre $0.01 y ${usd(total)}.`);
    setSaving(true); setError("");
    const c = await supabase.from("cargos").insert({ consultorio_id: consultorioId, paciente_id: f.paciente_id, doctor_id: f.doctor_id || null, procedimiento: f.procedimiento.trim(), total, fecha: f.fecha, creado_por: userId || null }).select("id").single();
    if (c.error) { setSaving(false); return setError("No se pudo crear el cargo: " + c.error.message); }
    if (cobrarAhora) {
      const a = await supabase.from("abonos").insert({ cargo_id: c.data.id, monto, metodo: pago.metodo, fecha: pago.fecha, observaciones: pago.observaciones.trim() || null, creado_por: userId || null });
      if (a.error) { setSaving(false); return setError("El cargo se creó, pero no se pudo registrar el pago: " + a.error.message); }
    }
    setSaving(false);
    onSaved();
  }
  return (
    <Marco titulo="🧾 Nuevo cargo" sub="Cobro que no viene de un presupuesto (consulta, urgencia, etc.)" onClose={onClose} ocupado={saving}>
      <div className="cg2">
        <div className="fl"><label>Paciente *</label><select className="fi sm" value={f.paciente_id} onChange={(e) => setF({ ...f, paciente_id: e.target.value })}><option value="">Seleccionar…</option>{pacientes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
        <div className="fl"><label>Doctor</label><select className="fi sm" value={f.doctor_id} onChange={(e) => setF({ ...f, doctor_id: e.target.value })}><option value="">—</option>{doctores.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}</select></div>
      </div>
      <div className="fl" style={{ marginBottom: 12 }}><label>Concepto *</label><input className="fi sm" placeholder="Consulta de urgencia" value={f.procedimiento} onChange={(e) => setF({ ...f, procedimiento: e.target.value })} /></div>
      <div className="cg2">
        <div className="fl"><label>Total (USD) *</label><input className="fi sm mono" type="number" min="0" step="0.01" value={f.total} onChange={(e) => { setF({ ...f, total: e.target.value }); if (!cobrarAhora) setPago((p) => ({ ...p, monto: e.target.value })); }} /></div>
        <div className="fl"><label>Fecha</label><input className="fi sm" type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></div>
      </div>
      <label className="ck" style={{ marginBottom: 8 }}><input type="checkbox" checked={cobrarAhora} onChange={(e) => { setCobrarAhora(e.target.checked); if (e.target.checked && !pago.monto) setPago({ ...pago, monto: f.total }); }} />Registrar un pago ahora</label>
      {cobrarAhora && <CamposPago pago={pago} setPago={setPago} max={f.total} />}
      {error && <div className="txt-sm" style={{ color: "var(--rose)", marginBottom: 10 }}>{error}</div>}
      <div className="flex gap8" style={{ justifyContent: "flex-end" }}>
        <button className="btn-sm sec" type="button" onClick={onClose} disabled={saving}>Cancelar</button>
        <button className="btn-sm" type="button" onClick={guardar} disabled={saving}>{saving ? "Guardando…" : "💾 Crear cargo"}</button>
      </div>
    </Marco>
  );
}
