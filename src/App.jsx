import { useState, lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { useAuth } from "./lib/AuthContext";
import { navSectionsForRole } from "./lib/modules";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Loading from "./components/Loading";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Configuracion = lazy(() => import("./pages/Configuracion"));
const Pacientes = lazy(() => import("./pages/Pacientes"));
const Citas = lazy(() => import("./pages/Citas"));
const Presupuesto = lazy(() => import("./pages/Presupuesto"));
const Inventario = lazy(() => import("./pages/Inventario"));
const Odontograma = lazy(() => import("./pages/Odontograma"));
const HistoriaClinica = lazy(() => import("./pages/HistoriaClinica"));
const HcMsp = lazy(() => import("./pages/HcMsp"));
const Laboratorio = lazy(() => import("./pages/Laboratorio"));
const Contabilidad = lazy(() => import("./pages/Contabilidad"));
const RRHH = lazy(() => import("./pages/RRHH"));
const Recetario = lazy(() => import("./pages/Recetario"));
const Imagenes = lazy(() => import("./pages/Imagenes"));
const Notificaciones = lazy(() => import("./pages/Notificaciones"));
const Agenda = lazy(() => import("./pages/Agenda"));
const Proximamente = lazy(() => import("./pages/Proximamente"));

function Shell() {
  const { user, role, loading } = useAuth();
  const [mod, setMod] = useState("dashboard");
  const irA = (m) => setMod(m);

  if (loading) return <Loading />;
  if (!user) return null;

  const sections = navSectionsForRole(role);

  let page;
  if (mod === "dashboard") return <Dashboard irA={irA} />;
  if (mod === "configuracion") return <Configuracion />;
  if (mod === "pacientes") return <Pacientes />;
  if (mod === "calendario") return <Citas irA={irA} />;
  if (mod === "presupuesto") return <Presupuesto />;
  if (mod === "inventario") return <Inventario />;
  if (mod === "odontograma") return <Odontograma />;
  if (mod === "historia") return <HistoriaClinica />;
  if (mod === "hc_msp") return <HcMsp />;
  if (mod === "laboratorio") return <Laboratorio />;
  if (mod === "contabilidad") return <Contabilidad />;
  if (mod === "rrhh") return <RRHH />;
  if (mod === "recetario") return <Recetario />;
  if (mod === "imagenes") return <Imagenes />;
  if (mod === "notificaciones") return <Notificaciones />;
  if (mod === "agenda") return <Agenda />;
  page = <Proximamente />;

  return (
    <div className="app-shell">
      <Sidebar sections={sections} mod={mod} setMod={setMod} />
      <div className="main-area">
        <Topbar />
        <ErrorBoundary>
          <Suspense fallback={<Loading />}>
            {page}
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Shell />
    </ErrorBoundary>
  );
}
