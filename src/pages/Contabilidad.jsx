import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const CATEGORIAS_GASTO = ["Insumos odontológicos", "Servicios (luz/agua/internet)", "Arriendo", "Nómina", "Marketing", "Mantenimiento", "Otros"];
const METODOS_PAGO = ["efectivo", "transferencia", "tarjeta_debito", "tarjeta_credito", "cheque", "otro"];
const TIPOS_ANTICIPO = ["anticipo", "bono", "prestamo"];

function fmt(n) {
  return "$" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function rangoDeFechas(periodo) {
  const hoy = new Date();
  const hasta = hoy.toISOString().slice(0, 10);
  let desde;
  if (periodo === "mes") desde = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
  else if (periodo === "trimestre") { const d = new Date(hoy); d.setMonth(d.getMonth() - 3); desde = d.toISOString().slice(0, 10); }
  else if (periodo === "anio") desde = `${hoy.getFullYear()}-01-01`;
  else desde = "2000-01-01";
  return { desde, hasta };
}

const TABS = [
  { id: "pagos", label: "💰 Pagos de pacientes" },
  { id: "gastos", label: "🧾 Compras y gastos" },
  { id: "anticipos", label: "💸 Anticipos" },
  { id: "flujo", label: "💧 Flujo de caja" },
];

export default function Contabilidad() {
  const { profile } = useAuth();
  const consultorioId = profile?.consultorio_id || null;
  const [periodo, setPeriodo] = useState("todo");
  const [tab, setTab] = useState("pagos");
  const [loading, setLoading] = useState(true);
  const [cargos, setCargos] = useState([]);
  const [abonos, setAbonos] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [anticipos, setAnticipos] = useState([]);
  const [empleados, setEmpleados] = useState([]);

  const [gastoForm, setGastoForm] = useState({ concepto: "", categoria: CATEGORIAS_GASTO[0], proveedor: "", monto: "", metodo: METODOS_PAGO[0] });
  const [anticipoForm, setAnticipoForm] = useState({ empleado_id: "", tipo: TIPOS_ANTICIPO[0], monto: "", observaciones: "" });
  const [msg, setMsg] = useState("");

  const { desde, hasta } = rangoDeFechas(periodo);

  async function cargar() {
    if (!consultorioId) { setLoading(false); return; }
    setLoading(true);
    const [{ data: c }, { data: g }, { data: a }, { data: emp }] = await Promise.all([
      supabase.from("cargos").select("id,total,fecha,procedimiento,paciente_id,doctor_id,pacientes(nombre),doctores(nombre)").eq("consultorio_id", consultorioId).gte("fecha", desde).lte("fecha", hasta).order("fecha", { ascending: false }),
      supabase.from("gastos").select("*").eq("consultorio_id", consultorioId).gte("fecha", desde).lte("fecha", hasta).order("fecha", { ascending: false }),
      supabase.from("anticipos").select("*, empleados(nombre)").gte("fecha", desde).lte("fecha", hasta).order("fecha", { ascending: false }),
      supabase.from("empleados").select("id,nombre").eq("consultorio_id", consultorioId).eq("activo", true).order("nombre"),
    ]);
    const cargoIds = (c || []).map((x) => x.id);
    let abonosData = [];
    if (cargoIds.length) {
      const { data } = await supabase.from("abonos").select("*, cargos(paciente_id)").in("cargo_id", cargoIds);
      abonosData = data || [];
    }
    setCargos(c || []);
    setAbonos(abonosData);
    setGastos(g || []);
    setAnticipos(a || []);
    setEmpleados(emp || []);
    setLoading(false);
  }

  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [consultorioId, periodo]);

  const abonosPorCargo = useMemo(() => {
    const map = {};
    abonos.forEach((a) => { map[a.cargo_id] = (map[a.cargo_id] || 0) + Number(a.monto || 0); });
    return map;
  }, [abonos]);

  const totalFacturado = useMemo(() => cargos.reduce((s, c) => s + Number(c.total || 0), 0), [cargos]);
  const totalCobrado = useMemo(() => abonos.reduce((s, a) => s + Number(a.monto || 0), 0), [abonos]);
  const saldoPendiente = totalFacturado - totalCobrado;
  const totalGastos = useMemo(() => gastos.reduce((s, g) => s + Number(g.monto || 0), 0), [gastos]);
  const totalAnticipos = useMemo(() => anticipos.reduce((s, a) => s + Number(a.monto || 0), 0), [anticipos]);
  const resultadoNeto = totalCobrado - totalGastos - totalAnticipos;

  const ingresosPorDoctor = useMemo(() => {
    const map = {};
    cargos.forEach((c) => {
      const nombre = c.doctores?.nombre || "Sin doctor";
      const cobrado = abonosPorCargo[c.id] || 0;
      map[nombre] = (map[nombre] || 0) + cobrado;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [cargos, abonosPorCargo]);

  const cuentasPorCobrar = useMemo(() => {
    const hoy = new Date();
    return cargos
      .map((c) => {
        const pagado = abonosPorCargo[c.id] || 0;
        const saldo = Number(c.total || 0) - pagado;
        const dias = Math.floor((hoy - new Date(c.fecha)) / 86400000);
        return { ...c, pagado, saldo, dias };
      })
      .filter((c) => c.saldo > 0.01)
      .sort((a, b) => b.dias - a.dias);
  }, [cargos, abonosPorCargo]);

  function riesgo(dias) {
    if (dias > 60) return { label: "Alto", tag: "tr" };
    if (dias > 30) return { label: "Medio", tag: "ta" };
    return { label: "Bajo", tag: "tg" };
  }

  async function guardarGasto() {
    if (!gastoForm.concepto.trim() || !gastoForm.monto) { setMsg("Completa concepto y monto."); return; }
    const { error } = await supabase.from("gastos").insert({
      concepto: gastoForm.concepto.trim(),
      categoria: gastoForm.categoria,
      proveedor: gastoForm.proveedor || null,
      monto: parseFloat(gastoForm.monto) || 0,
      metodo: gastoForm.metodo,
      fecha: new Date().toISOString().slice(0, 10),
      estado: "pagado",
      consultorio_id: consultorioId,
      creado_por: profile?.id || null,
    });
    if (error) { setMsg("No se pudo guardar el gasto: " + error.message); return; }
    setGastoForm({ concepto: "", categoria: CATEGORIAS_GASTO[0], proveedor: "", monto: "", metodo: METODOS_PAGO[0] });
    setMsg("✓ Gasto registrado.");
    await cargar();
  }

  async function guardarAnticipo() {
    if (!anticipoForm.empleado_id || !anticipoForm.monto) { setMsg("Selecciona empleado y monto."); return; }
    const { error } = await supabase.from("anticipos").insert({
      empleado_id: anticipoForm.empleado_id,
      tipo: anticipoForm.tipo,
      monto: parseFloat(anticipoForm.monto) || 0,
      observaciones: anticipoForm.observaciones || null,
      fecha: new Date().toISOString().slice(0, 10),
      creado_por: profile?.id || null,
    });
    if (error) { setMsg("No se pudo guardar el anticipo: " + error.message); return; }
    setAnticipoForm({ empleado_id: "", tipo: TIPOS_ANTICIPO[0], monto: "", observaciones: "" });
    setMsg("✓ Anticipo registrado.");
    await cargar();
  }

  function exportarCSV() {
    const filas = [["Tipo", "Fecha", "Descripción", "Monto"]];
    cargos.forEach((c) => filas.push(["Cargo", c.fecha, c.procedimiento || c.pacientes?.nombre || "", c.total]));
    abonos.forEach((a) => filas.push(["Abono", a.fecha, a.metodo || "", a.monto]));
    gastos.forEach((g) => filas.push(["Gasto", g.fecha, g.concepto, -g.monto]));
    anticipos.forEach((a) => filas.push(["Anticipo", a.fecha, a.tipo, -a.monto]));
    const csv = filas.map((f) => f.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `contabilidad_${desde}_a_${hasta}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ padding: 28 }}>
      <div className="flex items-c jc-b mb18" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="fw7" style={{ fontSize: 15 }}>💳 Contabilidad profesional</div>
          <div className="txt-muted">Ingresos cobrados, gastos operativos, anticipos y cuentas por cobrar — datos reales de tu base de datos.</div>
        </div>
        <div className="flex gap8 items-c" style={{ flexWrap: "wrap" }}>
          <div className="currency-pill" style={{ padding: "4px 10px" }}>
            <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>PERÍODO</span>
            <select className="fi sm" value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={{ border: "none", background: "none", fontWeight: 700, color: "var(--teal)", width: "auto", padding: "2px 4px" }}>
              <option value="mes">Mes actual</option>
              <option value="trimestre">Trimestre</option>
              <option value="anio">Año</option>
              <option value="todo">Todo el historial</option>
            </select>
          </div>
          <button className="btn-sm sec" onClick={exportarCSV}>📥 Exportar</button>
        </div>
      </div>

      <div className="kpi-row" style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
        <div className="kpi t"><div className="kpi-ic">💵</div><div className="kpi-v">{loading ? "—" : fmt(totalCobrado)}</div><div className="kpi-l">Ingresos cobrados</div></div>
        <div className="kpi r"><div className="kpi-ic">🧾</div><div className="kpi-v">{loading ? "—" : fmt(totalGastos)}</div><div className="kpi-l">Gastos / Compras</div></div>
        <div className="kpi g" style={{ "--kg": "#FBF3DC" }}><div className="kpi-ic">💸</div><div className="kpi-v">{loading ? "—" : fmt(totalAnticipos)}</div><div className="kpi-l">Anticipos nómina</div></div>
        <div className="kpi g"><div className="kpi-ic">📈</div><div className="kpi-v">{loading ? "—" : fmt(resultadoNeto)}</div><div className="kpi-l">Resultado neto</div></div>
        <div className="kpi b"><div className="kpi-ic">⏳</div><div className="kpi-v">{loading ? "—" : fmt(saldoPendiente)}</div><div className="kpi-l">Cuentas por cobrar</div></div>
      </div>

      <div className="card mb16" style={{ marginTop: 16 }}>
        <div className="card-h">
          <div className="card-t">🧾 Integración proforma → factura → cobro</div>
        </div>
        <div className="card-b" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          <div className="kpi t" style={{ margin: 0 }}><div className="kpi-l">Facturas (cargos)</div><div className="kpi-v">{cargos.length}</div></div>
          <div className="kpi g" style={{ margin: 0 }}><div className="kpi-l">Cobradas por completo</div><div className="kpi-v">{cargos.filter((c) => (abonosPorCargo[c.id] || 0) >= Number(c.total) - 0.01).length}</div></div>
          <div className="kpi r" style={{ margin: 0 }}><div className="kpi-l">Saldo en facturas</div><div className="kpi-v">{fmt(saldoPendiente)}</div></div>
          <div className="kpi b" style={{ margin: 0 }}><div className="kpi-l">Ingresos por facturas</div><div className="kpi-v">{fmt(totalCobrado)}</div></div>
        </div>
      </div>

      <div className="sc-tabs mb18" style={{ background: "#fff", borderRadius: "var(--r) var(--r) 0 0", border: "1px solid var(--border)", borderBottom: "none" }}>
        {TABS.map((t) => (
          <div key={t.id} className={"sc-tab" + (tab === t.id ? " on" : "")} onClick={() => setTab(t.id)}>{t.label}</div>
        ))}
      </div>

      {msg && <div className="txt-sm" style={{ color: msg.startsWith("✓") ? "var(--teal)" : "var(--rose)", marginBottom: 10 }}>{msg}</div>}

      {tab === "pagos" && (
        <div className="tw">
          <table>
            <thead><tr><th>Paciente</th><th>Procedimiento</th><th>Fecha</th><th>Total</th><th>Pagado</th><th>Saldo</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="txt-muted" style={{ padding: 20 }}>Cargando…</td></tr>}
              {!loading && cargos.length === 0 && <tr><td colSpan={6} className="txt-muted" style={{ padding: 20 }}>Sin cargos en este período.</td></tr>}
              {!loading && cargos.map((c) => {
                const pagado = abonosPorCargo[c.id] || 0;
                const saldo = Number(c.total) - pagado;
                return (
                  <tr key={c.id}>
                    <td className="fw6">{c.pacientes?.nombre || "?"}</td>
                    <td>{c.procedimiento || "—"}</td>
                    <td>{c.fecha}</td>
                    <td className="mono">{fmt(c.total)}</td>
                    <td className="mono" style={{ color: "var(--teal)" }}>{fmt(pagado)}</td>
                    <td className="mono" style={{ color: saldo > 0.01 ? "var(--rose)" : "var(--muted)" }}>{fmt(saldo)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "gastos" && (
        <div>
          <div className="card mb14">
            <div className="card-h"><div className="card-t">+ Registrar gasto</div></div>
            <div className="card-b" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 0.7fr auto", gap: 10, alignItems: "end" }}>
              <div className="fl" style={{ margin: 0 }}><label>Concepto</label><input className="fi sm" value={gastoForm.concepto} onChange={(e) => setGastoForm((f) => ({ ...f, concepto: e.target.value }))} /></div>
              <div className="fl" style={{ margin: 0 }}><label>Categoría</label>
                <select className="fi sm" value={gastoForm.categoria} onChange={(e) => setGastoForm((f) => ({ ...f, categoria: e.target.value }))}>
                  {CATEGORIAS_GASTO.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="fl" style={{ margin: 0 }}><label>Proveedor</label><input className="fi sm" value={gastoForm.proveedor} onChange={(e) => setGastoForm((f) => ({ ...f, proveedor: e.target.value }))} /></div>
              <div className="fl" style={{ margin: 0 }}><label>Monto</label><input className="fi sm mono" type="number" value={gastoForm.monto} onChange={(e) => setGastoForm((f) => ({ ...f, monto: e.target.value }))} /></div>
              <button className="btn-sm" onClick={guardarGasto}>+ Agregar</button>
            </div>
          </div>
          <div className="tw">
            <table>
              <thead><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Proveedor</th><th>Método</th><th>Monto</th></tr></thead>
              <tbody>
                {!loading && gastos.length === 0 && <tr><td colSpan={6} className="txt-muted" style={{ padding: 20 }}>Sin gastos en este período.</td></tr>}
                {gastos.map((g) => (
                  <tr key={g.id}>
                    <td>{g.fecha}</td><td className="fw6">{g.concepto}</td><td><span className="tag tb">{g.categoria}</span></td>
                    <td>{g.proveedor || "—"}</td><td className="txt-muted">{g.metodo}</td><td className="mono" style={{ color: "var(--rose)" }}>-{fmt(g.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "anticipos" && (
        <div>
          <div className="card mb14">
            <div className="card-h"><div className="card-t">+ Registrar anticipo</div></div>
            <div className="card-b" style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 0.8fr 1.2fr auto", gap: 10, alignItems: "end" }}>
              <div className="fl" style={{ margin: 0 }}><label>Empleado</label>
                <select className="fi sm" value={anticipoForm.empleado_id} onChange={(e) => setAnticipoForm((f) => ({ ...f, empleado_id: e.target.value }))}>
                  <option value="">Selecciona…</option>
                  {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              <div className="fl" style={{ margin: 0 }}><label>Tipo</label>
                <select className="fi sm" value={anticipoForm.tipo} onChange={(e) => setAnticipoForm((f) => ({ ...f, tipo: e.target.value }))}>
                  {TIPOS_ANTICIPO.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="fl" style={{ margin: 0 }}><label>Monto</label><input className="fi sm mono" type="number" value={anticipoForm.monto} onChange={(e) => setAnticipoForm((f) => ({ ...f, monto: e.target.value }))} /></div>
              <div className="fl" style={{ margin: 0 }}><label>Observaciones</label><input className="fi sm" value={anticipoForm.observaciones} onChange={(e) => setAnticipoForm((f) => ({ ...f, observaciones: e.target.value }))} /></div>
              <button className="btn-sm" onClick={guardarAnticipo}>+ Agregar</button>
            </div>
            {empleados.length === 0 && !loading && (
              <div className="card-b txt-sm txt-muted" style={{ paddingTop: 0 }}>No hay empleados activos registrados todavía — agrégalos en RRHH · Nómina para poder registrar anticipos.</div>
            )}
          </div>
          <div className="tw">
            <table>
              <thead><tr><th>Fecha</th><th>Empleado</th><th>Tipo</th><th>Observaciones</th><th>Monto</th></tr></thead>
              <tbody>
                {!loading && anticipos.length === 0 && <tr><td colSpan={5} className="txt-muted" style={{ padding: 20 }}>Sin anticipos en este período.</td></tr>}
                {anticipos.map((a) => (
                  <tr key={a.id}>
                    <td>{a.fecha}</td><td className="fw6">{a.empleados?.nombre || "?"}</td><td><span className="tag ta">{a.tipo}</span></td>
                    <td className="txt-muted">{a.observaciones || "—"}</td><td className="mono" style={{ color: "var(--rose)" }}>-{fmt(a.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "flujo" && (
        <div>
          <div className="g2 mb16">
            <div className="card">
              <div className="card-h"><div className="card-t">Entradas vs salidas (período)</div></div>
              <div className="card-b">
                <div className="pd-row"><span className="label">Cobros de pacientes</span><span className="value green">{fmt(totalCobrado)}</span></div>
                <div className="pd-row"><span className="label">Gastos operativos</span><span className="value red">-{fmt(totalGastos)}</span></div>
                <div className="pd-row"><span className="label">Nómina y anticipos</span><span className="value red">-{fmt(totalAnticipos)}</span></div>
                <div className="pd-total" style={{ borderRadius: 8, marginTop: 10 }}>
                  <span className="pd-total-label">FLUJO NETO</span>
                  <span className="pd-total-value">{fmt(resultadoNeto)}</span>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-h"><div className="card-t">Ingresos por doctor</div></div>
              <div className="card-b">
                {ingresosPorDoctor.length === 0 && <div className="txt-muted" style={{ textAlign: "center", padding: 16 }}>Sin datos</div>}
                {ingresosPorDoctor.map(([nombre, monto]) => (
                  <div key={nombre} className="pd-row"><span className="label">{nombre}</span><span className="value">{fmt(monto)}</span></div>
                ))}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-h"><div className="card-t">Antigüedad de cuentas por cobrar</div></div>
            <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
              <table>
                <thead><tr><th>Paciente</th><th>Procedimiento</th><th>Total</th><th>Pagado</th><th>Saldo</th><th>Días</th><th>Riesgo</th></tr></thead>
                <tbody>
                  {cuentasPorCobrar.length === 0 && <tr><td colSpan={7} className="txt-muted" style={{ padding: 20 }}>Sin cuentas pendientes 🎉</td></tr>}
                  {cuentasPorCobrar.map((c) => {
                    const r = riesgo(c.dias);
                    return (
                      <tr key={c.id}>
                        <td className="fw6">{c.pacientes?.nombre || "?"}</td>
                        <td>{c.procedimiento || "—"}</td>
                        <td className="mono">{fmt(c.total)}</td>
                        <td className="mono">{fmt(c.pagado)}</td>
                        <td className="mono" style={{ color: "var(--rose)" }}>{fmt(c.saldo)}</td>
                        <td className="mono">{c.dias}</td>
                        <td><span className={"tag " + r.tag}>{r.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="card mt14">
        <div className="card-b txt-sm txt-muted">
          🚧 Pendiente: cuando el backend de Railway ("dentflow-brain") esté desplegado, este módulo pasará a consultar <code>/api/contabilidad/resumen</code> en vez de calcular todo aquí — mismo resultado, pero validado también del lado del servidor. También falta "Estado de resultados" formal (P&amp;L) — depende de tener categorizados todos los gastos fijos vs variables.
        </div>
      </div>
    </div>
  );
}
