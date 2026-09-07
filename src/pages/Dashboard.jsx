import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

function hoyEnZona(tz) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export default function Dashboard() {
  const { profile, consultorio, timezone } = useAuth();
  const [kpis, setKpis] = useState({ citasHoy: null, pacientes: null, doctores: null, presupuestosActivos: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activo = true;
    (async () => {
      if (!profile?.consultorio_id) {
        setLoading(false);
        return;
      }
      const consultorioId = profile.consultorio_id;
      const hoy = hoyEnZona(timezone);

      const [citasHoy, pacientes, doctores, presupuestos] = await Promise.all([
        supabase.from("citas").select("id", { count: "exact", head: true }).eq("consultorio_id", consultorioId).eq("fecha", hoy),
        supabase.from("pacientes").select("id", { count: "exact", head: true }).eq("consultorio_id", consultorioId),
        supabase.from("doctores").select("id", { count: "exact", head: true }).eq("consultorio_id", consultorioId),
        supabase.from("presupuestos").select("id", { count: "exact", head: true }).eq("consultorio_id", consultorioId).in("estado", ["pendiente", "aceptado"]),
      ]);

      if (!activo) return;
      setKpis({
        citasHoy: citasHoy.count ?? 0,
        pacientes: pacientes.count ?? 0,
        doctores: doctores.count ?? 0,
        presupuestosActivos: presupuestos.count ?? 0,
      });
      setLoading(false);
    })();
    return () => {
      activo = false;
    };
  }, [profile, timezone]);

  const v = (n) => (loading ? "—" : n ?? "—");

  return (
    <div style={{ padding: 28 }}>
      <div className="flex items-c" style={{ justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div className="card-t" style={{ fontSize: 22 }}>
            {consultorio?.nombre || "Dashboard"}
          </div>
          <div className="txt-sm txt-muted">Resumen general de hoy</div>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi t">
          <div className="kpi-ic">📅</div>
          <div className="kpi-v">{v(kpis.citasHoy)}</div>
          <div className="kpi-l">Citas hoy</div>
        </div>
        <div className="kpi g">
          <div className="kpi-ic">👥</div>
          <div className="kpi-v">{v(kpis.pacientes)}</div>
          <div className="kpi-l">Total pacientes</div>
        </div>
        <div className="kpi b">
          <div className="kpi-ic">🩺</div>
          <div className="kpi-v">{v(kpis.doctores)}</div>
          <div className="kpi-l">Doctores activos</div>
        </div>
        <div className="kpi r">
          <div className="kpi-ic">💰</div>
          <div className="kpi-v">{v(kpis.presupuestosActivos)}</div>
          <div className="kpi-l">Presupuestos activos</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-h">
          <div className="card-t">🚧 Migración en progreso</div>
        </div>
        <div className="card-b txt-sm txt-muted">
          Este es el primer módulo migrado a React. El resto del dashboard (flujo por clínica,
          actividad de citas, próximas citas, presupuestos recientes) se agrega en la siguiente
          fase — de momento sigue disponible completo en el sistema original.
        </div>
      </div>
    </div>
  );
}
