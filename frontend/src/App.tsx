import { AuthProvider, useAuth } from "./auth/AuthContext";
import { useRoute } from "./hooks/useRoute";
import { AdminPage } from "./pages/AdminPage";
import { AuthPage } from "./pages/AuthPage";
import { BenchmarksPage } from "./pages/BenchmarksPage";
import { ComponentLab } from "./pages/ComponentLab";
import { ComparisonPage } from "./pages/ComparisonPage";
import { EnterprisePage } from "./pages/EnterprisePage";
import { LandingPage } from "./pages/LandingPage";
import { PilotKitPage } from "./pages/PilotKitPage";
import { OrganizationPage } from "./pages/OrganizationPage";
import { ReportsPage } from "./pages/ReportsPage";
import { ResultsPage } from "./pages/ResultsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ShareViewerPage } from "./pages/ShareViewerPage";
import { TeamPage } from "./pages/TeamPage";
import { UploadPage } from "./pages/UploadPage";
import { WorkflowPage } from "./pages/WorkflowPage";
import { WorkspacePage } from "./pages/WorkspacePage";

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

function AppRoutes() {
  const { path, navigate } = useRoute();
  const { isAuthenticated, isLoading } = useAuth();

  if (path === "/login") {
    return <AuthPage mode="login" navigate={navigate} />;
  }

  if (path === "/register") {
    return <AuthPage mode="register" navigate={navigate} />;
  }

  if (path === "/forgot") {
    return <AuthPage mode="forgot" navigate={navigate} />;
  }

  if (path.startsWith("/share/")) {
    return <ShareViewerPage token={path.replace("/share/", "")} />;
  }

  if (path.startsWith("/app")) {
    if (path === "/app/design-system") {
      return <ComponentLab />;
    }

    if (!isAuthenticated) {
      if (isLoading) {
        return (
          <main className="auth-loading-shell">
            <strong>Validando sesion segura...</strong>
            <span>Estamos comprobando el acceso antes de abrir el workspace.</span>
          </main>
        );
      }
      return <AuthPage mode="login" navigate={navigate} />;
    }

    if (path.startsWith("/app/upload")) {
      return <UploadPage />;
    }

    if (path.startsWith("/app/new-analysis")) {
      return <WorkspacePage active="new-analysis" initialShowWizard />;
    }

    if (path.startsWith("/app/admin")) {
      return <AdminPage />;
    }

    if (path.startsWith("/app/benchmarks")) {
      return <BenchmarksPage />;
    }

    if (path.startsWith("/app/enterprise")) {
      return <EnterprisePage />;
    }

    if (path.startsWith("/app/settings")) {
      return <SettingsPage />;
    }

    if (path.startsWith("/app/compare")) {
      return <ComparisonPage />;
    }

    if (path.startsWith("/app/workflow")) {
      return <WorkflowPage />;
    }

    if (path.startsWith("/app/results")) {
      return <ResultsPage />;
    }

    if (path.startsWith("/app/reports")) {
      return <ReportsPage />;
    }

    if (path.startsWith("/app/team")) {
      return <TeamPage />;
    }

    if (path.startsWith("/app/organization")) {
      return <OrganizationPage />;
    }

    return <WorkspacePage />;
  }

  if (path === "/pilot-kit") {
    return <PilotKitPage />;
  }

  return <LandingPage />;
}
