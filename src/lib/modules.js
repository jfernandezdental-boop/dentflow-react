// Estado real de la migración a Vite+React. "ready" son los módulos ya
// portados a componentes React funcionales; el resto sigue viviendo en el
// index.html original hasta que se migren en las siguientes fases.
export const NAV_SECTIONS = [
  {
    title: "Principal",
    items: [
      { mod: "dashboard", icon: "📊", label: "Dashboard", ready: true },
      { mod: "pacientes", icon: "👥", label: "Pacientes", ready: true },
      { mod: "calendario", icon: "📅", label: "Calendario", ready: true },
      { mod: "agenda", icon: "🗓️", label: "Agenda Doctor", ready: false },
    ],
  },
  {
    title: "Clínico",
    items: [
      { mod: "historia", icon: "🗂️", label: "Historia Clínica", ready: false },
      { mod: "odontograma", icon: "🦷", label: "Odontograma", ready: true },
      { mod: "hcmsp", icon: "📋", label: "HC MSP · form.033", ready: false },
      { mod: "recetario", icon: "💊", label: "Recetario", ready: true },
      { mod: "presupuesto", icon: "💰", label: "Presupuesto", ready: true },
      { mod: "laboratorio", icon: "🔬", label: "Laboratorio", ready: true },
      { mod: "imagenes", icon: "🖼️", label: "Imágenes", ready: false },
    ],
  },
  {
    title: "Administración",
    items: [
      { mod: "contabilidad", icon: "💳", label: "Contabilidad", ready: true },
      { mod: "inventario", icon: "📦", label: "Inventario", ready: true },
      { mod: "rrhh", icon: "👔", label: "RRHH · Nómina", ready: false },
      { mod: "notificaciones", icon: "🔔", label: "Notificaciones", ready: true },
      { mod: "configuracion", icon: "⚙️", label: "Configuración", ready: true },
    ],
  },
];

// Módulos visibles por rol — mismo mapa que ROLE_MODULES en el sistema
// original, para que el sidebar no muestre a un doctor o recepcionista
// módulos que no les corresponden.
export const ROLE_MODULES = {
  admin: ["dashboard", "pacientes", "calendario", "agenda", "historia", "odontograma", "hcmsp", "recetario", "presupuesto", "laboratorio", "imagenes", "contabilidad", "inventario", "rrhh", "notificaciones", "configuracion"],
  doctor: ["dashboard", "pacientes", "calendario", "agenda", "historia", "odontograma", "hcmsp", "recetario", "presupuesto", "laboratorio", "imagenes", "notificaciones"],
  recepcionista: ["dashboard", "pacientes", "calendario", "agenda", "historia", "odontograma", "hcmsp", "recetario", "presupuesto", "laboratorio", "imagenes", "contabilidad", "inventario", "notificaciones"],
  personal: ["dashboard"],
  paciente: ["dashboard"],
};

export function navSectionsForRole(rolUi) {
  const permitidos = ROLE_MODULES[rolUi] || ROLE_MODULES.personal;
  return NAV_SECTIONS.map((sec) => ({
    ...sec,
    items: sec.items.filter((it) => permitidos.includes(it.mod)),
  })).filter((sec) => sec.items.length > 0);
}
