export default function Proximamente({ label }) {
  return (
    <div style={{ padding: 40 }}>
      <div className="card" style={{ maxWidth: 520, margin: "40px auto", textAlign: "center", padding: 36 }}>
        <div style={{ fontSize: 34, marginBottom: 10 }}>🚧</div>
        <div className="card-t" style={{ marginBottom: 8 }}>{label}</div>
        <div className="txt-sm txt-muted">
          Este módulo todavía vive en el sistema original (index.html) — se migrará a
          React en la siguiente fase, sin perder ninguna funcionalidad actual.
        </div>
      </div>
    </div>
  );
}
