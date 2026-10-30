import { Component } from "react";

// Evita que un error en un módulo deje toda la pantalla en blanco.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("Error en el módulo:", error, info?.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="pgm">
        <div className="card">
          <div className="empty">
            <div className="ic">⚠️</div>
            <div className="t">Este módulo tuvo un problema</div>
            <div className="s">Tus datos no se perdieron. Intenta de nuevo; si el problema continúa, recarga la página o avisa a soporte.</div>
            <button className="btn-sm" type="button" onClick={() => this.setState({ error: null })}>Reintentar</button>
          </div>
        </div>
      </div>
    );
  }
}
