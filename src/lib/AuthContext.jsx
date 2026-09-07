import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "./supabaseClient";

const ROLES = {
  admin: { name: "Dr. Admin", label: "Administrador" },
  doctor: { name: "Dr. Gómez", label: "Doctor" },
  recepcionista: { name: "Recepción López", label: "Recepcionista" },
  personal: { name: "Personal", label: "Personal" },
  paciente: { name: "Ana Martínez", label: "Paciente" },
};

function mapRolDbToUi(rol) {
  if (rol === "super_admin") return "admin";
  if (ROLES[rol]) return rol;
  return "admin";
}

function formatSegundosBloqueo(seg) {
  if (!seg || seg < 60) return `${seg || 0} segundos`;
  const min = Math.ceil(seg / 60);
  return `${min} minuto${min === 1 ? "" : "s"}`;
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [consultorio, setConsultorio] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Al montar: si ya hay una sesión guardada (localStorage, misma llave que el
  // sistema actual), recupera el perfil sin pedir login de nuevo.
  useEffect(() => {
    let activo = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!activo) return;
      if (data?.session?.user) {
        await cargarPerfil(data.session.user.id, data.session.user.app_metadata || {});
      }
      setLoadingSession(false);
    })();
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarPerfil = useCallback(async (userId, jwtMeta = {}) => {
    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (pErr || !prof) throw new Error("Se validó tu sesión pero no se encontró tu perfil.");
    if (jwtMeta.rol) prof.rol = jwtMeta.rol;
    if (jwtMeta.consultorio_id) prof.consultorio_id = jwtMeta.consultorio_id;

    let cons = null;
    if (prof.consultorio_id) {
      const { data } = await supabase.from("consultorios").select("*").eq("id", prof.consultorio_id).single();
      cons = data || null;
    }
    setProfile(prof);
    setConsultorio(cons);
    return { profile: prof, consultorio: cons };
  }, []);

  // Marca por consultorio: mismo mecanismo que el sistema original —
  // sobreescribe las variables CSS de color según lo que cada clínica haya
  // configurado, sin tocar el resto del sistema de diseño.
  useEffect(() => {
    const root = document.documentElement.style;
    if (consultorio?.color_primario) root.setProperty("--teal", consultorio.color_primario);
    if (consultorio?.color_secundario) root.setProperty("--teal2", consultorio.color_secundario);
    return () => {
      root.removeProperty("--teal");
      root.removeProperty("--teal2");
    };
  }, [consultorio]);

  const login = useCallback(async (email, password) => {
    if (!email || !password) {
      throw new Error('Ingresa correo y contraseña, o usa "Ver demo" para probar sin conexión.');
    }

    // Protección contra fuerza bruta: igual que el sistema actual, revisa
    // bloqueo ANTES de intentar el login.
    try {
      const { data: chk, error: chkErr } = await supabase.rpc("check_login_bloqueado", { p_email: email });
      const estado = Array.isArray(chk) ? chk[0] : chk;
      if (!chkErr && estado && estado.bloqueado) {
        throw new Error(`Demasiados intentos fallidos. Intenta de nuevo en ${formatSegundosBloqueo(estado.segundos_restantes)}.`);
      }
    } catch (e) {
      if (e?.message?.startsWith("Demasiados intentos")) throw e;
      // si la función no responde, no bloqueamos el login por eso
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    try {
      await supabase.rpc("registrar_intento_login", { p_email: email, p_exitoso: !error });
    } catch (e) {
      /* no crítico */
    }

    if (error) throw new Error(`No se pudo iniciar sesión: ${error.message}`);

    return cargarPerfil(data.user.id, data.user.app_metadata || {});
  }, [cargarPerfil]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setConsultorio(null);
  }, []);

  const rolUi = profile ? mapRolDbToUi(profile.rol) : null;
  const rolLabel = rolUi ? (ROLES[rolUi] || ROLES.admin).label : null;
  const timezone = consultorio?.timezone || "America/Guayaquil";

  const value = {
    profile,
    consultorio,
    rolUi,
    rolLabel,
    timezone,
    loadingSession,
    isLoggedIn: !!profile,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
