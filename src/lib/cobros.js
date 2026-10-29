import { supabase } from "./supabaseClient";

export const METODOS = [
  { v: "efectivo", label: "Efectivo" },
  { v: "transferencia", label: "Transferencia" },
  { v: "tarjeta_debito", label: "Tarjeta de débito" },
  { v: "tarjeta_credito", label: "Tarjeta de crédito" },
  { v: "cheque", label: "Cheque" },
  { v: "otro", label: "Otro" },
];
export const METODO_LABEL = Object.fromEntries(METODOS.map((m) => [m.v, m.label]));
export const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Mantiene coherente el estado del presupuesto con lo cobrado:
// pagado por completo → "cobrado"; si deja de estarlo → vuelve a "aceptado".
export async function sincronizarPresupuesto(cargoId) {
  const { data: cargo } = await supabase.from("cargos").select("id,total,presupuesto_id").eq("id", cargoId).single();
  if (!cargo?.presupuesto_id) return;
  const { data: abonos } = await supabase.from("abonos").select("monto").eq("cargo_id", cargoId);
  const pagado = redondear((abonos || []).reduce((s, a) => s + Number(a.monto || 0), 0));
  const { data: pres } = await supabase.from("presupuestos").select("id,estado").eq("id", cargo.presupuesto_id).single();
  if (!pres) return;
  const completo = pagado >= redondear(cargo.total) - 0.005 && redondear(cargo.total) > 0;
  if (completo && pres.estado !== "cobrado") await supabase.from("presupuestos").update({ estado: "cobrado" }).eq("id", pres.id);
  else if (!completo && pres.estado === "cobrado") await supabase.from("presupuestos").update({ estado: "aceptado" }).eq("id", pres.id);
}
