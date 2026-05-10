import { ArrowLeft, BrainCircuit, FileText, GitCompare, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { PraeviaLockup, PraeviaMark } from "../components/brand/PraeviaLogo";
import { Button, Input, LinkButton } from "../components/ui";
import { useAuth } from "../auth/AuthContext";
import { publicHref } from "../routing/paths";

type AuthMode = "login" | "register" | "forgot";

type AuthPageProps = {
  mode: AuthMode;
  navigate: (path: string) => void;
};

export function AuthPage({ mode, navigate }: AuthPageProps) {
  const { authMode, error, isLoading, login, recoverPassword, register } = useAuth();
  const [name, setName] = useState((import.meta.env.VITE_DEMO_USER_NAME as string | undefined) || "Nestor Guerra");
  const [email, setEmail] = useState((import.meta.env.VITE_DEMO_LOGIN_EMAIL as string | undefined) || "nestor@praevia.ai");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState((import.meta.env.VITE_DEMO_ORGANIZATION_NAME as string | undefined) || "PraevIA Demo");
  const [sentRecovery, setSentRecovery] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);

  const isRegister = mode === "register";
  const isForgot = mode === "forgot";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingConfirmation(false);

    if (isForgot) {
      await recoverPassword(email);
      setSentRecovery(true);
      return;
    }

    let nextSession = null;
    if (isRegister) {
      nextSession = await register({ name, email, password, organizationName });
    } else {
      nextSession = await login({ email, password });
    }

    if (nextSession) {
      navigate("/app");
    } else if (isRegister && authMode === "supabase") {
      setPendingConfirmation(true);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <a className="auth-back" href={publicHref("/")} onClick={(event) => { event.preventDefault(); navigate("/"); }}>
          <ArrowLeft size={15} />
          Volver a landing
        </a>
        <PraeviaLockup size={20} />
        <div className="auth-copy">
          <h1>{isRegister ? "Crear workspace corporativo." : isForgot ? "Recuperar acceso." : "Acceso privado."}</h1>
          <p>
            {isRegister
              ? "Crea una organizacion de trabajo y entra al entorno privado de NeuroImpact Analyzer."
              : isForgot
                ? "Enviaremos un enlace seguro de recuperacion si el email existe en la organizacion."
                : "Entra al workspace para crear proyectos, gestionar creditos y preparar analisis."}
          </p>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {isRegister ? (
            <Input label="Nombre" value={name} onChange={(event) => setName(event.target.value)} required />
          ) : null}
          <Input label="Email corporativo" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          {isRegister ? (
            <Input label="Organizacion" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} required />
          ) : null}
          {!isForgot ? (
            <Input
              label="Password"
              type="password"
              value={password}
              minLength={8}
              autoComplete={isRegister ? "new-password" : "current-password"}
              required={authMode !== "local"}
              help={authMode === "api"
                ? "Acceso beta validado por la API de PraevIA."
                : authMode === "supabase"
                  ? "Minimo 8 caracteres. La sesion se valida con Supabase Auth."
                  : "Modo local explicito para demo/desarrollo."}
              onChange={(event) => setPassword(event.target.value)}
            />
          ) : null}
          {error ? (
            <div className="auth-error">
              <ShieldCheck size={17} />
              {error}
            </div>
          ) : null}
          {sentRecovery ? (
            <div className="auth-success">
              <ShieldCheck size={17} />
              Si el email existe, recibira un enlace seguro con caducidad.
            </div>
          ) : null}
          {pendingConfirmation ? (
            <div className="auth-success">
              <Mail size={17} />
              Cuenta creada. Revisa el email para confirmar el acceso antes de entrar.
            </div>
          ) : null}
          <Button icon={isForgot ? <Mail size={16} /> : <LockKeyhole size={16} />} disabled={isLoading}>
            {isLoading ? "Validando..." : isRegister ? "Crear organizacion" : isForgot ? "Enviar recuperacion" : "Entrar al workspace"}
          </Button>
        </form>

        <div className="auth-switch">
          {mode === "login" ? (
            <>
              <a href={publicHref("/register")} onClick={(event) => { event.preventDefault(); navigate("/register"); }}>Crear cuenta</a>
              <a href={publicHref("/forgot")} onClick={(event) => { event.preventDefault(); navigate("/forgot"); }}>Recuperar password</a>
            </>
          ) : (
            <a href={publicHref("/login")} onClick={(event) => { event.preventDefault(); navigate("/login"); }}>Ya tengo cuenta</a>
          )}
        </div>
      </section>

      <aside className="auth-trust">
        <PraeviaMark size={54} />
        <h2>Decide que version usar. Antes de producir.</h2>
        <div className="auth-trust-grid">
          <div><BrainCircuit size={18} /><strong>NeuroAnalisis multimodal</strong><span>Analiza video, audio y texto para estimar respuesta neurocognitiva predicha.</span></div>
          <div><GitCompare size={18} /><strong>Comparativa A/B/C con IA</strong><span>Ordena versiones, calcula deltas y propone master, tramos donantes y cortes.</span></div>
          <div><FileText size={18} /><strong>Informes accionables GPT</strong><span>Convierte scores en decisiones, timecodes y recomendaciones listas para editar.</span></div>
        </div>
      </aside>
    </main>
  );
}
