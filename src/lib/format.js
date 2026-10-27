// Utilidades de formato compartidas por los módulos clínicos.
export function hoyISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Diferencia en días enteros entre dos fechas ISO (YYYY-MM-DD), sin efectos de zona horaria.
export function diasEntre(desdeISO, hastaISO) {
  if (!desdeISO || !hastaISO) return null;
  const [a, b, c] = desdeISO.slice(0, 10).split("-").map(Number);
  const [x, y, z] = hastaISO.slice(0, 10).split("-").map(Number);
  return Math.round((Date.UTC(x, y - 1, z) - Date.UTC(a, b - 1, c)) / 86400000);
}

export function fmtFecha(iso, opts) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-EC", opts || { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtHora(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
}

export function edadDesde(fechaNac) {
  if (!fechaNac) return "";
  const hoy = new Date();
  const [y, m, d] = fechaNac.slice(0, 10).split("-").map(Number);
  let e = hoy.getFullYear() - y;
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) e--;
  return e >= 0 ? String(e) : "";
}

export function escHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Teléfono → solo dígitos, para enlaces wa.me
export function soloDigitos(t) {
  return String(t || "").replace(/\D/g, "");
}
