import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const CATEGORIAS = ["Desechables", "Anestesia", "Materiales restaurativos", "Instrumental", "Protección personal", "Limpieza y esterilización"];

function fmt(n) {
  return "$" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function stockStatus(item) {
  const ratio = item.minimo > 0 ? item.stock / item.minimo : 1;
  if (item.stock === 0 || ratio < 0.3) return "critical";
  if (ratio < 1) return "low";
  return "ok";
}
const STATUS_LABEL = { critical: "🚨 Crítico", low: "⚠️ Bajo", ok: "✅ OK" };
const STATUS_COLOR = { critical: "var(--rose)", low: "var(--amber)", ok: "var(--green)" };

const EMPTY = { nombre: "", categoria: CATEGORIAS[0], unidad: "unidad", stock: "", minimo: "", precio: "", proveedor: "" };

function InsumoModal({ open, editing, onClose, onSaved, onDesactivado, consultorioId }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(
      editing
        ? { nombre: editing.nombre, categoria: editing.categoria, unidad: editing.unidad, stock: editing.stock, minimo: editing.minimo, precio: editing.precio, proveedor: editing.proveedor || "" }
        : EMPTY
    );
    setError("");
  }, [open, editing]);

  if (!open) return null;
  function set(f, v) { setForm((s) => ({ ...s, [f]: v })); }

  async function guardar() {
    if (!form.nombre.trim()) { setError("El nombre es obligatorio."); return; }
    setSaving(true);
    setError("");
    const payload = {
      nombre: form.nombre.trim(),
      categoria: form.categoria,
      unidad: form.unidad,
      stock: parseFloat(form.stock) || 0,
      minimo: parseFloat(form.minimo) || 0,
      precio: parseFloat(form.precio) || 0,
      proveedor: form.proveedor || null,
    };
    let res;
    if (editing) {
      res = await supabase.from("insumos").update(payload).eq("id", editing.id);
    } else {
      payload.consultorio_id = consultorioId;
      res = await supabase.from("insumos").insert(payload);
    }
    setSaving(false);
    if (res.error) { setError("No se pudo guardar: " + res.error.message); return; }
    onSaved();
  }

  async function desactivar() {
    if (!editing) return;
    if (!window.confirm("¿Desactivar este insumo? Deja de aparecer en el inventario activo.")) return;
    setSaving(true);
    const { error: err } = await supabase.from("insumos").update({ activo: false }).eq("id", editing.id);
    setSaving(false);
    if (err) { setError("No se pudo desactivar: " + err.message); return; }
    onDesactivado();
  }

  return (
    <div className="appt-modal on">
      <div className="appt-box" style={{ width: 460 }}>
        <div className="appt-box-title">{editing ? "✏️ Editar insumo" : "📦 Nuevo insumo"}</div>
        <div className="appt-box-sub">Materiales e instrumental del inventario</div>

        {editing && (
          <div className="appt-modal-edit-bar" style={{ display: "flex" }}>
            <div className="appt-edit-badge">✏️ Editando insumo</div>
            <button className="btn-delete-appt" type="button" onClick={desactivar} disabled={saving}>🗑 Desactivar</button>
          </div>
        )}

        <div className="fl"><label>Nombre</label><input className="fi sm" value={form.nombre} onChange={(e) => set("nombre", e.target.value)} /></div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div className="fl" style={{ margin: 0 }}>
            <label>Categoría</label>
            <select className="fi sm" value={form.categoria} onChange={(e) => set("categoria", e.target.value)}>
              {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="fl" style={{ margin: 0 }}>
            <label>Unidad</label>
            <input className="fi sm" placeholder="caja, unidad, ml…" value={form.unidad} onChange={(e) => set("unidad", e.target.value)} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div className="fl" style={{ margin: 0 }}>
            <label>Stock actual</label>
            <input className="fi sm mono" type="number" value={form.stock} onChange={(e) => set("stock", e.target.value)} />
          </div>
          <div className="fl" style={{ margin: 0 }}>
            <label>Stock mínimo</label>
            <input className="fi sm mono" type="number" value={form.minimo} onChange={(e) => set("minimo", e.target.value)} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div className="fl" style={{ margin: 0 }}>
            <label>Precio unitario</label>
            <input className="fi sm mono" type="number" value={form.precio} onChange={(e) => set("precio", e.target.value)} />
          </div>
          <div className="fl" style={{ margin: 0 }}>
            <label>Proveedor</label>
            <input className="fi sm" value={form.proveedor} onChange={(e) => set("proveedor", e.target.value)} />
          </div>
        </div>

        {error && <div className="txt-sm" style={{ color: "var(--rose)", marginBottom: 10 }}>{error}</div>}

        <div className="flex gap8" style={{ justifyContent: "flex-end" }}>
          <button className="btn-sm sec" type="button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn-sm" type="button" onClick={guardar} disabled={saving}>{saving ? "Guardando…" : "💾 Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

export default function Inventario() {
  const { profile } = useAuth();
  const consultorioId = profile?.consultorio_id || null;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroCat, setFiltroCat] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  async function cargar() {
    if (!consultorioId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.from("insumos").select("*").eq("consultorio_id", consultorioId).eq("activo", true).order("nombre");
    if (!error) setItems(data || []);
    setLoading(false);
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [consultorioId]);

  const filtrados = useMemo(() => (filtroCat === "all" ? items : items.filter((i) => i.categoria === filtroCat)), [items, filtroCat]);
  const kpis = useMemo(() => {
    const ok = items.filter((i) => stockStatus(i) === "ok").length;
    const low = items.filter((i) => stockStatus(i) === "low").length;
    const critical = items.filter((i) => stockStatus(i) === "critical").length;
    return { total: items.length, ok, low, critical };
  }, [items]);
  const necesitanOrden = useMemo(() => items.filter((i) => stockStatus(i) !== "ok"), [items]);

  function abrirNuevo() { setEditing(null); setModalOpen(true); }
  function abrirEditar(i) { setEditing(i); setModalOpen(true); }
  function cerrar() { setModalOpen(false); setEditing(null); }
  async function alGuardar() { cerrar(); await cargar(); }

  return (
    <div style={{ padding: 28 }}>
      <div className="flex items-c jc-b mb14">
        <div className="fw7" style={{ fontSize: 16 }}>📦 Inventario</div>
        <button className="btn-sm" onClick={abrirNuevo}>+ Nuevo insumo</button>
      </div>

      <div className="kpi-row mb14">
        <div className="kpi t"><div className="kpi-ic">📦</div><div className="kpi-v">{kpis.total}</div><div className="kpi-l">Insumos activos</div></div>
        <div className="kpi g"><div className="kpi-ic">✅</div><div className="kpi-v">{kpis.ok}</div><div className="kpi-l">Stock OK</div></div>
        <div className="kpi" style={{ borderTop: "3px solid var(--amber)" }}><div className="kpi-ic">⚠️</div><div className="kpi-v">{kpis.low}</div><div className="kpi-l">Stock bajo</div></div>
        <div className="kpi r"><div className="kpi-ic">🚨</div><div className="kpi-v">{kpis.critical}</div><div className="kpi-l">Crítico</div></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, alignItems: "start" }}>
        <div>
          <div className="cal-view-toggle mb14" role="tablist">
            <button type="button" className={"cvt-btn" + (filtroCat === "all" ? " on" : "")} onClick={() => setFiltroCat("all")}>Todas</button>
            {CATEGORIAS.map((c) => (
              <button key={c} type="button" className={"cvt-btn" + (filtroCat === c ? " on" : "")} onClick={() => setFiltroCat(c)}>{c}</button>
            ))}
          </div>

          <div className="tw">
            <table>
              <thead>
                <tr><th>Insumo</th><th>Categoría</th><th>Stock</th><th>Mínimo</th><th>Nivel</th><th>Estado</th><th>Precio</th></tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7} className="txt-muted" style={{ padding: 20 }}>Cargando…</td></tr>}
                {!loading && filtrados.length === 0 && <tr><td colSpan={7} className="txt-muted" style={{ padding: 20 }}>Sin insumos en esta categoría.</td></tr>}
                {!loading && filtrados.map((item) => {
                  const status = stockStatus(item);
                  const pct = Math.min(100, Math.round((item.stock / ((item.minimo || 1) * 2)) * 100));
                  return (
                    <tr key={item.id} onDoubleClick={() => abrirEditar(item)} style={{ cursor: "pointer" }} title="Doble clic para editar">
                      <td><strong>{item.nombre}</strong><div className="txt-muted" style={{ fontSize: 11 }}>{item.proveedor}</div></td>
                      <td><span className="tag tb">{item.categoria}</span></td>
                      <td className="mono">{item.stock} {item.unidad}</td>
                      <td className="mono txt-muted">{item.minimo}</td>
                      <td><div className="stock-bar"><div className="stock-fill" style={{ width: pct + "%", background: STATUS_COLOR[status] }} /></div></td>
                      <td><span className={"alert-badge " + status}>{STATUS_LABEL[status]}</span></td>
                      <td className="mono">{fmt(item.precio)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-h"><div className="card-t">🛒 Necesitan reposición ({necesitanOrden.length})</div></div>
          <div className="card-b" style={{ padding: necesitanOrden.length ? 0 : 16 }}>
            {necesitanOrden.length === 0 && <div className="txt-muted txt-sm" style={{ textAlign: "center" }}>✅ Todo el stock está saludable</div>}
            {necesitanOrden.map((item) => {
              const status = stockStatus(item);
              const sugerido = Math.max((item.minimo || 0) * 2 - item.stock, item.minimo || 0);
              return (
                <div key={item.id} className="flex items-c jc-b" style={{ padding: "10px 14px", borderTop: "1px solid var(--border)" }}>
                  <div>
                    <div className="txt-sm fw6">{item.nombre}</div>
                    <div className="txt-muted" style={{ fontSize: 11 }}>Sugerido: {sugerido} {item.unidad}</div>
                  </div>
                  <span className={"alert-badge " + status} style={{ fontSize: 10 }}>{STATUS_LABEL[status]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card mt14">
        <div className="card-b txt-sm txt-muted">
          🚧 Pendiente en esta versión: generar orden de compra automática (crea un gasto vinculado) y el sistema de lotes/vencimiento con Kardex — el archivo actual del sistema original tampoco los tiene conectados en esta rama.
        </div>
      </div>

      <InsumoModal open={modalOpen} editing={editing} consultorioId={consultorioId} onClose={cerrar} onSaved={alGuardar} onDesactivado={alGuardar} />
    </div>
  );
}
