// Utilidades puras de la Agenda (fechas ISO sin efectos de zona horaria + reparto de citas que se solapan).
export const pad = (n) => String(n).padStart(2, "0");
export const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseIso = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};
export const addDaysIso = (iso, n) => {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return isoOf(d);
};
export const mondayOf = (iso) => {
  const d = parseIso(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoOf(d);
};
export const addMonthsIso = (iso, n) => {
  const d = parseIso(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return isoOf(d);
};
/** 42 celdas (6 semanas, lunes primero) del mes que contiene `iso`. */
export function monthCells(iso) {
  const d = parseIso(iso);
  const start = mondayOf(isoOf(new Date(d.getFullYear(), d.getMonth(), 1, 12)));
  return Array.from({ length: 42 }, (_, i) => {
    const k = addDaysIso(start, i);
    return { iso: k, num: Number(k.slice(8)), inMonth: k.slice(0, 7) === iso.slice(0, 7) };
  });
}
export const timeToMin = (t) => {
  const [h, m] = String(t || "00:00").split(":").map(Number);
  return h * 60 + (m || 0);
};
export const minToTime = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/**
 * Reparte en columnas las citas que se solapan en el tiempo para que ninguna tape a otra.
 * Devuelve [{c, s, e, col, cols}] (s/e en minutos).
 */
export function layoutCitas(list) {
  const items = list
    .map((c) => {
      const s = timeToMin(c.hora_inicio);
      return { c, s, e: Math.max(timeToMin(c.hora_fin), s + 15) };
    })
    .sort((a, b) => a.s - b.s || a.e - b.e);
  const out = [];
  let cluster = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((x) => x.col + 1));
    cluster.forEach((x) => out.push({ ...x, cols }));
    cluster = [];
    clusterEnd = -1;
  };
  for (const it of items) {
    if (cluster.length && it.s >= clusterEnd) flush();
    let col = 0;
    while (cluster.some((x) => x.col === col && x.e > it.s)) col++;
    cluster.push({ ...it, col });
    clusterEnd = Math.max(clusterEnd, it.e);
  }
  if (cluster.length) flush();
  return out;
}
/** Rango de horas a pintar: 08–19 por defecto, se amplía si hay citas fuera de ese horario. */
export function rangoHoras(citas, h0 = 8, h1 = 19) {
  let a = h0;
  let b = h1;
  for (const c of citas) {
    a = Math.min(a, Math.floor(timeToMin(c.hora_inicio) / 60));
    b = Math.max(b, Math.ceil(timeToMin(c.hora_fin) / 60) - 1);
  }
  return [Math.max(0, a), Math.min(23, b)];
}
