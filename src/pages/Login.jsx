import { useState } from "react";
import { useAuth } from "../lib/AuthContext";

export default function Login({ onBack }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setMsg(err.message || "Error de conexión al iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at 18% 12%, #FFFFFF 0%, var(--bg) 45%, #D5E2DB 100%)",
        padding: 20,
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="login-box"
        style={{ position: "static", transform: "none" }}
      >
        {onBack && (
          <button type="button" className="txt-sm" onClick={onBack} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", marginBottom: 14 }}>
            ← Volver al inicio
          </button>
        )}
        <div className="lb-title">
          Dent<em>Flow</em> Pro
        </div>
        <div className="lb-sub">Sistema de gestión odontológica integral</div>

        <div className="fl">
          <label>Correo electrónico</label>
          <input
            className="fi"
            type="email"
            placeholder="tu@consultorio.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </div>
        <div className="fl">
          <label>Contraseña</label>
          <input
            className="fi"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {msg && (
          <div className="txt-sm" style={{ color: "var(--rose)", marginBottom: 10 }}>
            {msg}
          </div>
        )}

        <button className="btn-full" type="submit" disabled={loading}>
          {loading ? "Ingresando…" : "Ingresar al sistema →"}
        </button>
      </form>
    </div>
  );
}
