import { useState } from "react";
import "../styles/landing.css";

const I = (p) => (
  <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p} />
);
const TOOTH = "M7.5 3.5c-2 0-3.5 1.6-3.5 4 0 2.2.9 3.6 1.4 5.4.5 1.9.6 4.6 1.5 7 .3.8 1.3.8 1.6 0 .6-1.5.9-3.5 2.4-3.5s1.8 2 2.4 3.5c.3.8 1.3.8 1.6 0 .9-2.4 1-5.1 1.5-7 .5-1.8 1.4-3.2 1.4-5.4 0-2.4-1.5-4-3.5-4-1.6 0-2.2.9-4.5.9s-2.9-.9-4.5-.9z";

const BENEFICIOS = [
  { t: "2 limpiezas al año", d: "Limpiezas profesionales cada 6 meses para mantener tu salud oral óptima y prevenir problemas", i: <I><path d={TOOTH} /><path d="M19 2v4M17 4h4" /></I> },
  { t: "Scanner intraoral", d: "Tecnología de escaneo digital 3D sin molestias para control y planificación precisa", i: <I><rect x="4" y="3" width="16" height="9" rx="3" /><path d="M8 12v3a4 4 0 0 0 8 0v-3M12 19v2" /></I> },
  { t: "Prioridad en agenda", d: "Acceso prioritario a horas y atención preferente para pacientes del programa", i: <I><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></I> },
  { t: "15% dcto rehabilitación", d: "Descuento exclusivo del 15% en tratamientos de rehabilitación e implantes", i: <I><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7a1 1 0 0 1 .7.3l7.6 7.6a1 1 0 0 1 0 1.4l-7.7 7.7a1 1 0 0 1-1.4 0l-7.6-7.6a1 1 0 0 1-.3-.7z" /><circle cx="8.5" cy="8.5" r="1.3" /></I> },
];
const INCLUYE = [
  "Control dental mensual preventivo y seguimiento",
  "Evaluación clínica completa cada mes",
  "15% de descuento en rehabilitaciones e implantes",
  "Contacto directo por WhatsApp con Dra. Jessenia",
  "Primera evaluación sin costo para nuevos inscritos",
];

export default function Landing({ onLogin }) {
  const [f, setF] = useState({ nombre: "", email: "", mensaje: "" });
  const [aviso, setAviso] = useState("");
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  // TODO: conectar el envío (WhatsApp, correo o una tabla de Supabase). Mientras tanto no se pierde nada en silencio:
  const enviar = (e) => {
    e.preventDefault();
    setAviso("El envío del formulario aún no está conectado. Escríbenos por WhatsApp para inscribirte.");
  };

  return (
    <div className="lp">
      <header className="lp-nav">
        <a className="lp-brand" href="#inicio">
          <span className="lp-logo"><svg viewBox="0 0 24 24" width="24" height="24" fill="#fff"><path d={TOOTH} /></svg></span>
          <span>PROGRAMA SONRISA<br />VITTORIA</span>
        </a>
        <nav className="lp-links" aria-label="Principal">
          <a href="#inicio" className="on">Inicio</a><a href="#programa">Programa</a><a href="#plan">Beneficios</a>
          <a href="#plan">Precio</a><a href="#testimonios">Testimonios</a><a href="#contacto">Contacto</a>
        </nav>
        <a className="lp-btn" href="#contacto">Únete ahora</a>
      </header>

      <section className="lp-hero" id="inicio">
        <div className="lp-hero-txt">
          <h1>¿Quieres nunca más llegar a una urgencia de implante?</h1>
          <h2>Dra. Jessenia Fernandez</h2>
          <p className="lp-role">Implantóloga y Rehabilitadora Oral · Especialista en control y prevención dental</p>
          <p>Únete al programa de control dental mensual para prevenir urgencias, mantener tu sonrisa sana y ahorrar en tratamientos con seguimiento profesional personalizado.</p>
          <div className="lp-cta">
            <a className="lp-btn lp-btn-lg" href="#contacto">Inscribirme por $24.900/mes ✦</a>
            <a className="lp-btn lp-btn-out lp-btn-lg" href="#programa">Conocer el programa</a>
          </div>
        </div>
        <img className="lp-hero-img" src="/hero.jpg" alt="Dra. Jessenia Fernandez, implantóloga, en su consulta" />
      </section>

      <section className="lp-cards" id="programa">
        {BENEFICIOS.map((b) => (
          <article className="lp-card" key={b.t}><div className="lp-ico">{b.i}</div><h3>{b.t}</h3><p>{b.d}</p></article>
        ))}
      </section>

      <section className="lp-trio">
        <article className="lp-plan" id="plan">
          <h3>Plan Mensual</h3><div className="lp-sub">Programa Sonrisa Vittoria</div>
          <div className="lp-price">$24.900<span>/mes</span></div>
          <div className="lp-fine">IVA incluido · Cancela cuando quieras · Sin contrato de permanencia</div>
          <ul>{INCLUYE.map((t) => <li key={t}>{t}</li>)}</ul>
        </article>

        <article className="lp-testi" id="testimonios">
          <h3>Testimonios de pacientes</h3>
          <div className="lp-quote">
            <div className="lp-stars" aria-label="5 estrellas">★★★★★</div>
            <p>“El programa me ha cambiado la forma de cuidar mi sonrisa. Antes siempre llegaba con dolor a urgencia. Ahora con los controles mensuales me siento tranquila y segura. La Dra. Jessenia es cercana, profesional y explica todo con mucha calma. 100% recomendado.”</p>
            <div className="lp-who"><img src="/camila.jpg" alt="" /><div><b>Camila R.</b><span>Paciente desde agosto 2024 · 5.0 ★</span></div></div>
          </div>
        </article>

        <form className="lp-form" id="contacto" onSubmit={enviar}>
          <label>Nombre<input value={f.nombre} onChange={set("nombre")} placeholder="Tu nombre completo" required /></label>
          <label>Email<input type="email" value={f.email} onChange={set("email")} placeholder="tu@correo.com" required /></label>
          <label>Mensaje<textarea rows={3} value={f.mensaje} onChange={set("mensaje")} placeholder="Cuéntanos cómo podemos ayudarte…" /></label>
          <button className="lp-btn lp-btn-block" type="submit">Enviar mensaje</button>
          {aviso && <div className="lp-aviso" role="status">{aviso}</div>}
        </form>
      </section>

      <footer className="lp-foot">
        <span>© 2026 PROGRAMA SONRISA VITTORIA · Todos los derechos reservados</span>
        <span>Política de privacidad · Términos y condiciones · Instagram @sonrisavittoria · <button type="button" onClick={onLogin}>Acceso clínica</button></span>
      </footer>
    </div>
  );
}
