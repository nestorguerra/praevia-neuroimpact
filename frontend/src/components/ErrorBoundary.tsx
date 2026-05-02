import { Component, type ErrorInfo, type ReactNode } from "react";
import { captureFrontendError } from "../observability/sentry";
import { Button } from "./ui";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureFrontendError(error, { componentStack: info.componentStack });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="auth-loading-shell">
        <strong>Error registrado.</strong>
        <span>Hemos guardado el fallo para revisarlo. Recarga la pantalla para volver al producto.</span>
        <Button onClick={() => window.location.reload()}>Recargar</Button>
      </main>
    );
  }
}
