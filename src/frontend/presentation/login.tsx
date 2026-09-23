"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/src/frontend/components/ui/dialog";
import { fetchJson, readLocal } from "@/src/frontend/infrastructure/offline";
export default function Login({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [login, setLogin] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
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
        body: JSON.stringify({ login, password }),
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
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Entrar no FPY</DialogTitle>
          <DialogDescription>
            Use o usuário ou e-mail cadastrado pelo administrador.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <label>
            Usuário ou e-mail
            <input
              required
              maxLength={254}
              autoComplete="username"
              autoCapitalize="none"
              placeholder="iuran.freire"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
          </label>
          <label>
            Senha
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="form-footer">
            <button disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
          </div>
        </form>
        <p className="form-hint">
          Esqueceu a senha? Solicite a redefinição ao administrador.
        </p>
        <a href="/api/auth/recover-owner" target="_top" className="text-button">
          Acesso de recuperação do administrador
        </a>
      </DialogContent>
    </Dialog>
  );
}
