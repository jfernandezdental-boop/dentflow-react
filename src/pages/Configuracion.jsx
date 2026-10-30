import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const MODELO_XAI_DEF = "grok-4-1-fast-non-reasoning";
const BOT_IA_PROMPT_DEF =
  "Eres el asistente de citas de {consultorio}. Ayudas a pacientes a confirmar, reagendar o cancelar su cita por WhatsApp de forma breve, clara y cordial, en español. Solo puedes actuar sobre citas reales usando las herramientas disponibles: nunca inventes horarios ni confirmes nada sin llamar a la función correspondiente. Si el paciente pide algo fuera de tu alcance (una urgencia médica, una queja, algo que no puedas resolver), indícale que el consultorio lo contactará directamente.";

const REC_MSG_DEF =
  "Hola {paciente}, te recordamos tu cita el {fecha} a las {hora} con {doctor} en {consultorio}. Si necesitas reagendar, contáctanos.";

function Panel({ title, children }) {
  return (
    <div className="card">
      <div className="card-h">
        <div className="card-t">{title}</div>
      </div>
      <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

function SavedMsg({ state }) {
  if (!state.visible) return null;
  return (
    <div className="txt-sm" style={{ color: state.color }}>
      {state.text}
    </div>
  );
}

function RecordatoriosPanel({ consultorioId }) {
  const [activo, setActivo] = useState(false);
  const [diasAntes, setDiasAntes] = useState("1");
  const [horaEnvio, setHoraEnvio] = useState("09:00");
  const [canalWhatsapp, setCanalWhatsapp] = useState(true);
  const [canalEmail, setCanalEmail] = useState(false);
  const [mensaje, setMensaje] = useState(REC_MSG_DEF);
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioToken, setTwilioToken] = useState("");
  const [twilioFrom, setTwilioFrom] = useState("");
  const [sendgridKey, setSendgridKey] = useState("");
  const [sendgridFrom, setSendgridFrom] = useState("");
  const [msg, setMsg] = useState({ visible: false, text: "", color: "" });

  useEffect(() => {
    if (!consultorioId) return;
    (async () => {
      const { data } = await supabase.from("recordatorios_config").select("*").eq("consultorio_id", consultorioId).maybeSingle();
      if (data) {
        setActivo(!!data.activo);
        setDiasAntes(String(data.dias_antes ?? "1"));
        setHoraEnvio((data.hora_envio || "09:00").slice(0, 5));
        setCanalWhatsapp(!!data.canal_whatsapp);
        setCanalEmail(!!data.canal_email);
        setMensaje(data.mensaje_template || REC_MSG_DEF);
        setTwilioSid(data.twilio_account_sid || "");
        setTwilioToken(data.twilio_auth_token || "");
        setTwilioFrom(data.twilio_whatsapp_from || "");
        setSendgridKey(data.sendgrid_api_key || "");
        setSendgridFrom(data.sendgrid_from_email || "");
      }
    })();
  }, [consultorioId]);

  async function guardar() {
    if (!consultorioId) {
      setMsg({ visible: true, color: "var(--rose)", text: "Inicia sesión con una cuenta real (no demo) para guardar cambios." });
      return;
    }
    setMsg({ visible: true, color: "var(--muted)", text: "Guardando…" });
    const payload = {
      consultorio_id: consultorioId,
      activo,
      dias_antes: parseInt(diasAntes, 10),
      hora_envio: horaEnvio,
      canal_whatsapp: canalWhatsapp,
      canal_email: canalEmail,
      mensaje_template: mensaje || null,
      twilio_account_sid: twilioSid || null,
      twilio_auth_token: twilioToken || null,
      twilio_whatsapp_from: twilioFrom || null,
      sendgrid_api_key: sendgridKey || null,
      sendgrid_from_email: sendgridFrom || null,
    };
    const { error } = await supabase.from("recordatorios_config").upsert(payload, { onConflict: "consultorio_id" });
    if (error) setMsg({ visible: true, color: "var(--rose)", text: "No se pudo guardar: " + error.message });
    else setMsg({ visible: true, color: "var(--teal)", text: "✓ Guardado. Los próximos recordatorios usarán esta configuración." });
  }

  return (
    <Panel title="🔔 Recordatorios automáticos">
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} style={{ width: 16, height: 16 }} />
        <span className="fw6 txt-sm">Activar envío automático</span>
      </label>

      <div className="flex gap8">
        <div className="fl" style={{ flex: 1 }}>
          <label>Enviar</label>
          <select className="fi" value={diasAntes} onChange={(e) => setDiasAntes(e.target.value)}>
            <option value="0">El mismo día</option>
            <option value="1">1 día antes</option>
            <option value="2">2 días antes</option>
            <option value="3">3 días antes</option>
            <option value="7">1 semana antes</option>
          </select>
        </div>
        <div className="fl" style={{ flex: 1 }}>
          <label>Hora de envío</label>
          <input className="fi" type="time" value={horaEnvio} onChange={(e) => setHoraEnvio(e.target.value)} />
        </div>
      </div>

      <div className="flex gap8">
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={canalWhatsapp} onChange={(e) => setCanalWhatsapp(e.target.checked)} style={{ width: 15, height: 15 }} />
          <span className="txt-sm">📱 WhatsApp</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={canalEmail} onChange={(e) => setCanalEmail(e.target.checked)} style={{ width: 15, height: 15 }} />
          <span className="txt-sm">✉️ Email</span>
        </label>
      </div>

      <div className="fl">
        <label>Mensaje (usa {"{paciente}"}, {"{fecha}"}, {"{hora}"}, {"{doctor}"}, {"{consultorio}"})</label>
        <textarea className="fi" rows={3} style={{ resize: "vertical" }} value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
      </div>

      <div style={{ background: "var(--bg)", borderRadius: 9, padding: 13, border: "1px solid var(--border)" }}>
        <div className="fw7 txt-sm mb8">📱 WhatsApp (Twilio)</div>
        <input className="fi sm" placeholder="SID de cuenta Twilio" style={{ marginBottom: 7 }} value={twilioSid} onChange={(e) => setTwilioSid(e.target.value)} />
        <input className="fi sm" type="password" placeholder="Token de autenticación" style={{ marginBottom: 7 }} value={twilioToken} onChange={(e) => setTwilioToken(e.target.value)} />
        <input className="fi sm" placeholder="Número WhatsApp Twilio, ej: +14155238886" value={twilioFrom} onChange={(e) => setTwilioFrom(e.target.value)} />
      </div>

      <div style={{ background: "var(--bg)", borderRadius: 9, padding: 13, border: "1px solid var(--border)" }}>
        <div className="fw7 txt-sm mb8">✉️ Email (SendGrid)</div>
        <input className="fi sm" type="password" placeholder="API Key de SendGrid" style={{ marginBottom: 7 }} value={sendgridKey} onChange={(e) => setSendgridKey(e.target.value)} />
        <input className="fi sm" placeholder="Email remitente verificado" value={sendgridFrom} onChange={(e) => setSendgridFrom(e.target.value)} />
      </div>

      <SavedMsg state={msg} />
      <button className="btn-sm" style={{ alignSelf: "flex-start" }} onClick={guardar}>
        💾 Guardar
      </button>
    </Panel>
  );
}

function BotIaPanel({ consultorioId }) {
  const [activo, setActivo] = useState(false);
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioToken, setTwilioToken] = useState("");
  const [twilioFrom, setTwilioFrom] = useState("");
  const [proveedor, setProveedor] = useState("anthropic");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [xaiKey, setXaiKey] = useState("");
  const [modelo, setModelo] = useState("claude-haiku-4-5-20251001");
  const [modelosXai, setModelosXai] = useState([]);
  const [probando, setProbando] = useState(false);
  const [prueba, setPrueba] = useState(null);
  const [prompt, setPrompt] = useState(BOT_IA_PROMPT_DEF);
  const [horas, setHoras] = useState("4");
  const [maxSeg, setMaxSeg] = useState("1");
  const [msg, setMsg] = useState({ visible: false, text: "", color: "" });
  const recCache = useRef(null);

  useEffect(() => {
    if (!consultorioId) return;
    (async () => {
      const [{ data: bot }, { data: rec }] = await Promise.all([
        supabase.from("bot_conversacional_config").select("*").eq("consultorio_id", consultorioId).maybeSingle(),
        supabase.from("recordatorios_config").select("twilio_account_sid,twilio_auth_token,twilio_whatsapp_from").eq("consultorio_id", consultorioId).maybeSingle(),
      ]);
      recCache.current = rec || null;
      if (bot) {
        setActivo(!!bot.activo);
        setTwilioSid(bot.twilio_account_sid || "");
        setTwilioToken(bot.twilio_auth_token || "");
        setTwilioFrom(bot.twilio_whatsapp_from || "");
        setProveedor(bot.proveedor_ia === "xai" ? "xai" : "anthropic");
        setAnthropicKey(bot.anthropic_api_key || "");
        setXaiKey(bot.xai_api_key || "");
        setModelo(bot.modelo || (bot.proveedor_ia === "xai" ? MODELO_XAI_DEF : "claude-haiku-4-5-20251001"));
        setPrompt(bot.prompt_sistema || BOT_IA_PROMPT_DEF);
        setHoras(String(bot.horas_espera_seguimiento ?? "4"));
        setMaxSeg(String(bot.max_seguimientos ?? "1"));
      }
    })();
  }, [consultorioId]);

  function cambiarProveedor(p) {
    setProveedor(p);
    setPrueba(null);
    // El modelo de un proveedor no sirve en el otro: se pasa al recomendado.
    if (p === "xai" && !/^grok/i.test(modelo)) setModelo(MODELO_XAI_DEF);
    if (p === "anthropic" && !/^claude/i.test(modelo)) setModelo("claude-haiku-4-5-20251001");
  }

  async function probarConexion() {
    const key = proveedor === "xai" ? xaiKey : anthropicKey;
    if (!key.trim()) { setPrueba({ ok: false, texto: "Escribe la API key antes de probar." }); return; }
    setProbando(true);
    setPrueba(null);
    const { data, error } = await supabase.functions.invoke("bot-ia-probar", { body: { proveedor, api_key: key, modelo } });
    setProbando(false);
    if (error || !data) { setPrueba({ ok: false, texto: "No se pudo probar: " + (error?.message || "sin respuesta") }); return; }
    if (!data.ok) { setPrueba({ ok: false, texto: data.error || "La clave no fue aceptada." }); return; }
    if (proveedor === "xai") setModelosXai(data.modelos || []);
    const modeloOk = data.prueba === "ok";
    setPrueba({
      ok: proveedor === "anthropic" ? true : modeloOk,
      texto: proveedor === "anthropic"
        ? `✓ Clave válida. ${data.modelos?.length || 0} modelos disponibles.`
        : modeloOk
          ? `✓ Clave válida y el modelo «${modelo}» responde. ${data.modelos?.length || 0} modelos Grok disponibles.`
          : `La clave es válida, pero el modelo «${modelo}» falló (${data.prueba || "sin prueba"}). Elige uno de la lista.`,
    });
  }

  function copiarDeRecordatorios() {
    const rec = recCache.current;
    if (!rec || (!rec.twilio_account_sid && !rec.twilio_auth_token && !rec.twilio_whatsapp_from)) {
      setMsg({ visible: true, color: "var(--rose)", text: 'Primero completa los datos de Twilio en el panel de Recordatorios.' });
      return;
    }
    setTwilioSid(rec.twilio_account_sid || "");
    setTwilioToken(rec.twilio_auth_token || "");
    setTwilioFrom(rec.twilio_whatsapp_from || "");
  }

  async function guardar() {
    if (!consultorioId) {
      setMsg({ visible: true, color: "var(--rose)", text: "Inicia sesión con una cuenta real (no demo) para guardar cambios." });
      return;
    }
    setMsg({ visible: true, color: "var(--muted)", text: "Guardando…" });
    const payload = {
      consultorio_id: consultorioId,
      activo,
      twilio_account_sid: twilioSid || null,
      twilio_auth_token: twilioToken || null,
      twilio_whatsapp_from: twilioFrom || null,
      proveedor_ia: proveedor,
      anthropic_api_key: anthropicKey || null,
      xai_api_key: xaiKey || null,
      modelo: modelo || (proveedor === "xai" ? MODELO_XAI_DEF : "claude-haiku-4-5-20251001"),
      prompt_sistema: prompt || BOT_IA_PROMPT_DEF,
      horas_espera_seguimiento: parseInt(horas, 10),
      max_seguimientos: parseInt(maxSeg, 10),
    };
    const { error } = await supabase.from("bot_conversacional_config").upsert(payload, { onConflict: "consultorio_id" });
    if (error) setMsg({ visible: true, color: "var(--rose)", text: "No se pudo guardar: " + error.message });
    else setMsg({ visible: true, color: "var(--teal)", text: "✓ Guardado. El bot usará esta configuración en la próxima conversación." });
  }

  return (
    <Panel title="🤖 Bot conversacional de WhatsApp (IA)">
      <div className="txt-sm txt-muted">
        Cuando un paciente responde al recordatorio (o escribe directo), este bot conversa con IA hasta
        confirmar, reagendar o cancelar la cita en el sistema real.
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} style={{ width: 16, height: 16 }} />
        <span className="fw6 txt-sm">Activar bot conversacional</span>
      </label>

      <div style={{ background: "var(--bg)", borderRadius: 9, padding: 13, border: "1px solid var(--border)" }}>
        <div className="flex items-c" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <div className="fw7 txt-sm">📱 WhatsApp (Twilio)</div>
          <button type="button" className="btn-sm sec" style={{ fontSize: 11, padding: "4px 9px" }} onClick={copiarDeRecordatorios}>
            Usar los mismos datos de Recordatorios
          </button>
        </div>
        <input className="fi sm" placeholder="SID de cuenta Twilio" style={{ marginBottom: 7 }} value={twilioSid} onChange={(e) => setTwilioSid(e.target.value)} />
        <input className="fi sm" type="password" placeholder="Token de autenticación" style={{ marginBottom: 7 }} value={twilioToken} onChange={(e) => setTwilioToken(e.target.value)} />
        <input className="fi sm" placeholder="Número WhatsApp Twilio, ej: +14155238886" value={twilioFrom} onChange={(e) => setTwilioFrom(e.target.value)} />
      </div>

      <div style={{ background: "var(--bg)", borderRadius: 9, padding: 13, border: "1px solid var(--border)" }}>
        <div className="fw7 txt-sm mb8">🧠 Inteligencia artificial</div>
        <select className="fi sm" style={{ marginBottom: 7 }} value={proveedor} onChange={(e) => cambiarProveedor(e.target.value)} aria-label="Proveedor de IA">
          <option value="anthropic">Anthropic (Claude)</option>
          <option value="xai">xAI (Grok)</option>
        </select>
        {proveedor === "anthropic" ? (
          <>
            <input className="fi sm" type="password" autoComplete="off" placeholder="API key de console.anthropic.com" style={{ marginBottom: 7 }} value={anthropicKey} onChange={(e) => setAnthropicKey(e.target.value)} />
            <select className="fi sm" value={modelo} onChange={(e) => setModelo(e.target.value)}>
              <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (recomendado, más económico)</option>
              <option value="claude-sonnet-5">Claude Sonnet 5 (más capaz, mayor costo)</option>
            </select>
          </>
        ) : (
          <>
            <input className="fi sm" type="password" autoComplete="off" placeholder="API key de console.x.ai (empieza con xai-)" style={{ marginBottom: 7 }} value={xaiKey} onChange={(e) => setXaiKey(e.target.value)} />
            <input className="fi sm" list="modelos-grok" placeholder="Modelo Grok" value={modelo} onChange={(e) => setModelo(e.target.value)} />
            <datalist id="modelos-grok">
              {[...new Set([MODELO_XAI_DEF, "grok-4-1-fast-reasoning", ...modelosXai])].map((m) => <option key={m} value={m} />)}
            </datalist>
            <div className="txt-muted" style={{ marginTop: 5 }}>Recomendado: «{MODELO_XAI_DEF}» (rápido y con herramientas). Usa «Probar conexión» para ver los modelos que tu cuenta tiene disponibles.</div>
          </>
        )}
        <div className="flex gap8 items-c" style={{ marginTop: 9, flexWrap: "wrap" }}>
          <button type="button" className="btn-sm sec" onClick={probarConexion} disabled={probando}>{probando ? "Probando…" : "🔌 Probar conexión"}</button>
          {prueba && <span className="txt-sm fw6" style={{ color: prueba.ok ? "var(--green)" : "var(--rose)" }}>{prueba.texto}</span>}
        </div>
      </div>

      <div className="fl">
        <label>Instrucciones del bot (personalidad y reglas)</label>
        <textarea className="fi" rows={4} style={{ resize: "vertical" }} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      </div>

      <div className="flex gap8">
        <div className="fl" style={{ flex: 1 }}>
          <label>Seguir si no responde, tras</label>
          <select className="fi" value={horas} onChange={(e) => setHoras(e.target.value)}>
            <option value="1">1 hora</option>
            <option value="2">2 horas</option>
            <option value="4">4 horas</option>
            <option value="8">8 horas</option>
            <option value="24">24 horas</option>
          </select>
        </div>
        <div className="fl" style={{ flex: 1 }}>
          <label>Máx. seguimientos</label>
          <select className="fi" value={maxSeg} onChange={(e) => setMaxSeg(e.target.value)}>
            <option value="1">1 vez</option>
            <option value="2">2 veces</option>
            <option value="3">3 veces</option>
          </select>
        </div>
      </div>

      <SavedMsg state={msg} />
      <button className="btn-sm" style={{ alignSelf: "flex-start" }} onClick={guardar}>
        💾 Guardar
      </button>
    </Panel>
  );
}

export default function Configuracion() {
  const { profile } = useAuth();
  const consultorioId = profile?.consultorio_id || null;

  return (
    <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18, maxWidth: 640 }}>
      <div className="card-t" style={{ fontSize: 22 }}>
        ⚙️ Configuración
      </div>
      <RecordatoriosPanel consultorioId={consultorioId} />
      <BotIaPanel consultorioId={consultorioId} />
    </div>
  );
}
