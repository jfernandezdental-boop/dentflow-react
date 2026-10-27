import { useState, lazy, Suspense } from "react";
import { useAuth } from "./lib/AuthContext";
import { navSectionsForRole } from "./lib/modules";
import Login from "./pages/Login";
import Landing from "./pages/Landing";

// Carga perezosa: cada módulo se descarga solo cuando el usuario lo abre,
// no todo junto al entrar al sistema. Esto importa cada vez más a medida
// que se migran los ~12 módulos que faltan (Citas, Odontograma, Facturación…).
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Configuracion = lazy(() => import("./pages/Configuracion"));
const Pacientes = lazy(() => import("./pages/Pacientes"));
const Citas = lazy(() => import("./pages/Citas"));
const Presupuesto = lazy(() => import("./pages/Presupuesto"));
const Inventario = lazy(() => import("./pages/Inventario"));
const Odontograma = lazy(() => import("./pages/Odontograma"));
const Contabilidad = lazy(() => import("./pages/Contabilidad"));
const Laboratorio = lazy(() => import("./pages/Laboratorio"));
const Recetario = lazy(() => import("./pages/Recetario"));
const Notificaciones = lazy(() => import("./pages/Notificaciones"));
const Proximamente = lazy(() => import("./pages/Proximamente"));

function getInitials(name) {
  return (name || "")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function Shell() {
  const { profile, rolUi, rolLabel, logout } = useAuth();
  const [mod, setMod] = useState("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const sections = navSectionsForRole(rolUi);

  const displayName = profile?.nombre || "Usuario";

  function renderMod() {
    if (mod === "dashboard") return <Dashboard />;
    if (mod === "configuracion") return <Configuracion />;
    if (mod === "pacientes") return <Pacientes />;
    if (mod === "calendario") return <Citas />;
    if (mod === "presupuesto") return <Presupuesto />;
    if (mod === "inventario") return <Inventario />;
    if (mod === "odontograma") return <Odontograma />;
    if (mod === "contabilidad") return <Contabilidad />;
    if (mod === "laboratorio") return <Laboratorio />;
    if (mod === "recetario") return <Recetario />;
    if (mod === "notificaciones") return <Notificaciones />;
    const item = sections.flatMap((s) => s.items).find((i) => i.mod === mod);
    return <Proximamente label={item?.label || mod} />;
  }

  function irA(nombreMod) {
    setMod(nombreMod);
    setMobileOpen(false); // en móvil, elegir un módulo cierra el menú
  }

  return (
    <div id="app" className="on">
      <div className={"mobile-overlay" + (mobileOpen ? " on" : "")} onClick={() => setMobileOpen(false)} />
      <aside className={"sidebar" + (mobileOpen ? " mobile-on" : "")}>
        <div className="sb-logo">
          <div className="ic">🦷</div>Dent<em>Flow</em>
        </div>
        <div className="sb-role">{rolLabel}</div>
        {sections.map((sec) => (
          <div className="sb-sec" key={sec.title}>
            <div className="sb-sec-t">{sec.title}</div>
            {sec.items.map((it) => (
              <div
                key={it.mod}
                className={"ni" + (mod === it.mod ? " on" : "")}
                onClick={() => irA(it.mod)}
                title={it.ready ? "" : "Aún en el index.html original — pendiente de migrar"}
              >
                <span className="icon">{it.icon}</span>
                {it.label}
                {!it.ready && <span className="bdg" style={{ background: "var(--bg)", color: "var(--muted)" }}>•</span>}
              </div>
            ))}
          </div>
        ))}
        <div className="sb-user">
          <div className="su-av">{getInitials(displayName)}</div>
          <div>
            <div className="su-name">{displayName}</div>
            <div className="su-role">{rolLabel}</div>
          </div>
          <button className="btn-out" onClick={logout} title="Cerrar sesión">
            ⏻
          </button>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <button className="icon-btn mobile-menu-btn" style={{ display: "none" }} onClick={() => setMobileOpen(true)} aria-label="Menú">
            ☰
          </button>
          <div className="pg-title" style={{ flex: 1 }} />
        </div>
        <Suspense
          fallback={
            <div style={{ padding: 40, color: "var(--muted)" }}>Cargando módulo…</div>
          }
        >
          {renderMod()}
        </Suspense>
      </main>
    </div>
  );
}

export default function App() {
  const { isLoggedIn, loadingSession } = useAuth();
  const [verLogin, setVerLogin] = useState(false);

  if (loadingSession) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "var(--muted)" }}>
        Cargando…
      </div>
    );
  }

  if (isLoggedIn) return <Shell />;
  return verLogin ? <Login onBack={() => setVerLogin(false)} /> : <Landing onLogin={() => setVerLogin(true)} />;
}
