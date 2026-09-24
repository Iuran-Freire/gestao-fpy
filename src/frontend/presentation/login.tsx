"use client";
import { useState } from "react";
import Image from "next/image";
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { fetchJson, readLocal } from "@/src/frontend/infrastructure/offline";

export default function Login({
  onClose,
  onSuccess,
  loading = false,
  dismissible = false,
  online = true,
}: {
  onClose: () => void;
  onSuccess: () => void;
  loading?: boolean;
  dismissible?: boolean;
  online?: boolean;
}) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const local = await readLocal();
      if (
        local?.pending.length &&
        ![
          local.user.username?.toLowerCase(),
          local.user.email.toLowerCase(),
        ].includes(login.trim().toLowerCase())
      )
        throw Error(
          "Sincronize os lançamentos antes de trocar de conta. Para reenviar, entre com a mesma conta anterior.",
        );
      await fetchJson("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ login: login.trim(), password }),
      });
      setPassword("");
      onSuccess();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={dismissible ? "login-screen login-screen-overlay" : "login-screen"}>
      <div className="login-layout">
        <section className="login-intro" aria-label="Gestão de FPY">
          <Image src="/inventus-power-logo.svg" alt="Inventus Power" width={190} height={55} priority />
          <div className="login-intro-copy">
            <span className="login-kicker">CONTROLE DE QUALIDADE</span>
            <h1>Gestão de FPY</h1>
            <p>Produção, defeitos e planos de ação em um só lugar.</p>
          </div>
          <div className="login-intro-foot">
            <ShieldCheck size={20} aria-hidden="true" />
            <span>Acesso individual para acompanhar e registrar cada etapa.</span>
          </div>
        </section>
        <section className="login-panel" aria-labelledby="login-title">
          {dismissible && (
            <button type="button" className="login-back" onClick={onClose}>
              Voltar ao sistema
            </button>
          )}
          <div className="login-panel-header">
            <span className="login-panel-icon"><LockKeyhole size={22} aria-hidden="true" /></span>
            <p className="login-kicker">ACESSO À CONTA</p>
            <h2 id="login-title">Entrar no sistema</h2>
            <p>Use o usuário ou e-mail cadastrado para acessar o FPY.</p>
          </div>
          <form className="login-form" onSubmit={submit}>
            <label htmlFor="fpy-login">Usuário ou e-mail</label>
            <input
              id="fpy-login"
              required
              maxLength={254}
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
              placeholder="Seu usuário ou e-mail"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
            <label htmlFor="fpy-password">Senha</label>
            <div className="login-password">
              <input
                id="fpy-password"
                required
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="login-password-toggle"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {!online && <p role="status" className="login-status">Conecte-se à rede para entrar na sua conta.</p>}
            {error && <p role="alert" className="error">{error}</p>}
            <button className="login-submit" disabled={busy || loading || !online}>
              {busy ? "Entrando…" : loading ? "Carregando sessão…" : "Entrar"}
              {!busy && !loading && online && <ArrowRight size={18} aria-hidden="true" />}
            </button>
          </form>
          <div className="login-help">
            <p>Esqueceu a senha? Solicite a redefinição ao administrador.</p>
            <a href="/api/auth/recover-owner" target="_top">Recuperação do administrador</a>
          </div>
        </section>
      </div>
    </main>
  );
}
