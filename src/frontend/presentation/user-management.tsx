"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  KeyRound,
  UserX,
  UserCheck,
  History,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Choice } from "./entry-form";
import { fetchJson } from "@/src/frontend/infrastructure/offline";
import type { User } from "@/src/shared/domain/fpy";
type UserAudit = {
  id: number;
  actor: string;
  actor_name?: string | null;
  action: string;
  after?: string | null;
  at: string;
};
const roles = [
  { value: "operador", label: "Operador" },
  { value: "supervisor", label: "Supervisor" },
  { value: "lider", label: "Líder" },
  { value: "tecnica", label: "Técnica" },
];
export function UserEditor({
  target,
  actor,
  onClose,
  onSaved,
  onPassword,
}: {
  target?: User;
  actor: User;
  onClose: () => void;
  onSaved: () => void;
  onPassword?: () => void;
}) {
  const [name, setName] = useState(target?.name || ""),
    [username, setUsername] = useState(target?.username || ""),
    [email, setEmail] = useState(target?.email || ""),
    [role, setRole] = useState(target?.role || "operador"),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await fetchJson("/api/users", {
        method: "POST",
        body: JSON.stringify({
          action: target ? "update" : "create",
          id: target?.id,
          revision: target?.revision,
          name,
          username,
          email,
          role,
          active: target?.active ?? 1,
          ...(!target ? { password } : {}),
        }),
      });
      onSaved();
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
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="entry-dialog">
        <DialogHeader>
          <DialogTitle>
            {target ? "Editar usuário" : "Novo usuário"}
          </DialogTitle>
          <DialogDescription>
            {target
              ? "As alterações não mudam os nomes nos lançamentos antigos."
              : "A senha inicial deverá ser trocada no primeiro acesso."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save}>
          <div className="form-grid">
            <label>
              Nome completo
              <input
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label>
              Usuário
              <input
                required
                minLength={3}
                maxLength={50}
                pattern="[A-Za-z0-9][A-Za-z0-9._\-]{2,49}"
                placeholder="iuran.freire"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoCapitalize="none"
                autoComplete="off"
              />
            </label>
            <label>
              E-mail (opcional)
              <input
                type="email"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
              />
            </label>
            {actor.owner && target?.id !== actor.id ? (
              <Choice
                label="Nível de acesso"
                value={role}
                onChange={(v) => setRole(v as User["role"])}
                items={roles}
              />
            ) : (
              <label>
                Nível de acesso
                <p>
                  {target?.owner
                    ? "Administrador principal"
                    : roles.find((r) => r.value === role)?.label}
                </p>
              </label>
            )}
            {!target && (
              <label className="wide-field">
                Senha temporária
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <small className="cell-sub">
                  Pode ter qualquer quantidade ou combinação de caracteres.
                  Entregue a senha ao usuário por um canal seguro.
                </small>
              </label>
            )}
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="form-footer">
            {target?.username && onPassword && (
              <button
                type="button"
                className="secondary"
                onClick={onPassword}
                disabled={busy}
              >
                <KeyRound size={16} /> Alterar senha
              </button>
            )}
            <button
              type="button"
              className="secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </button>
            <button disabled={busy}>
              {busy
                ? "Salvando…"
                : target
                  ? "Salvar alterações"
                  : "Criar usuário"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function PasswordEditor({
  user,
  reset = false,
  onClose,
  onSaved,
}: {
  user: User;
  reset?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [old, setOld] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await fetchJson(reset ? "/api/users" : "/api/auth/password", {
        method: "POST",
        body: JSON.stringify(
          reset
            ? { action: "reset", id: user.id, password }
            : { currentPassword: old, password },
        ),
      });
      onSaved();
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
        if (!o && !busy && !user.mustChange) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!user.mustChange}
        onEscapeKeyDown={(e) => {
          if (user.mustChange) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (user.mustChange) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {reset
              ? "Redefinir senha"
              : user.mustChange
                ? "Troque sua senha temporária"
                : "Minha senha"}
          </DialogTitle>
          <DialogDescription>
            {reset
              ? "Defina uma senha temporária para " +
                user.name +
                ". As sessões existentes serão encerradas."
              : "Escolha livremente o tamanho e os caracteres da senha."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save}>
          {!reset && user.hasPassword && (
            <label>
              Senha atual
              <input
                type="password"
                required
                autoComplete="current-password"
                value={old}
                onChange={(e) => setOld(e.target.value)}
              />
            </label>
          )}
          <label>
            Nova senha{reset ? " temporária" : ""}
            <input
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            Confirmar nova senha
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="form-footer">
            {!user.mustChange && (
              <button
                type="button"
                className="secondary"
                onClick={onClose}
                disabled={busy}
              >
                Cancelar
              </button>
            )}
            <button disabled={busy}>
              {busy ? "Salvando…" : "Salvar senha"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export default function UserManagement({
  actor,
  online,
  onUpdated,
}: {
  actor: User;
  online: boolean;
  onUpdated: () => void;
}) {
  const [users, setUsers] = useState<User[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [editing, setEditing] = useState<User | null | undefined>(undefined),
    [reset, setReset] = useState<User | null>(null),
    [toggle, setToggle] = useState<User | null>(null),
    [history, setHistory] = useState<UserAudit[] | null>(null),
    [search, setSearch] = useState("");
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setUsers(await fetchJson<User[]>("/api/users"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    if (!online) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [online, load]);
  function updated() {
    setSuccess("Alteração salva.");
    void load();
    onUpdated();
  }
  async function deactivate() {
    if (!toggle) return;
    setBusy(true);
    try {
      await fetchJson("/api/users", {
        method: "POST",
        body: JSON.stringify({
          ...toggle,
          action: "update",
          active: toggle.active === 1 ? 0 : 1,
        }),
      });
      setToggle(null);
      updated();
    } catch (e) {
      setError((e as Error).message);
      setToggle(null);
    } finally {
      setBusy(false);
    }
  }
  const filtered = users.filter((u) =>
    `${u.name} ${u.username || ""} ${u.email}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const allowed = (u: User) =>
    !!actor.owner || u.id === actor.id || (u.role === "operador" && !u.owner);
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Gestão de usuários</h2>
          <small className="cell-sub">
            {actor.owner ? "Administrador principal" : "Cadastro de operadores"}
          </small>
        </div>
        <div className="actions">
          <button
            className="secondary"
            disabled={busy || !online}
            onClick={load}
          >
            <RefreshCw size={17} /> Atualizar
          </button>
          <button disabled={busy || !online} onClick={() => setEditing(null)}>
            <Plus size={18} /> Novo usuário
          </button>
        </div>
      </div>
      <div className="panel-body">
        <label>
          Buscar usuário
          <input
            placeholder="Nome, usuário ou e-mail"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {!online && (
          <p className="error">Conecte-se para gerenciar usuários.</p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="success">
            {success}
          </p>
        )}
        <p className="form-hint">
          Desativar remove o acesso, mas preserva o histórico. O endereço
          hospedado também exige autorização na publicação privada.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            {["Nome", "Usuário / e-mail", "Nível", "Status", "Ações"].map(
              (x) => (
                <TableHead key={x}>{x}</TableHead>
              ),
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((u) => (
            <TableRow key={u.id}>
              <TableCell>
                <b>{u.name}</b>
              </TableCell>
              <TableCell>
                {u.username || "Usuário ainda não definido"}
                <small className="cell-sub">{u.email}</small>
              </TableCell>
              <TableCell>
                {u.owner
                  ? "Administrador principal"
                  : roles.find((r) => r.value === u.role)?.label}
              </TableCell>
              <TableCell>
                <span className={"badge " + (u.active !== 1 ? "warning" : "")}>
                  {u.active === 1 ? "Ativo" : "Desativado"}
                </span>
              </TableCell>
              <TableCell>
                <div className="row-actions">
                  <button
                    className="secondary"
                    disabled={!online || busy || !allowed(u)}
                    onClick={() => setEditing(u)}
                  >
                    <Pencil size={15} /> Editar
                  </button>
                  <button
                    className="secondary"
                    disabled={!online || busy || !allowed(u) || !u.username}
                    onClick={() => setReset(u)}
                  >
                    <KeyRound size={15} /> Senha
                  </button>
                  {!u.owner && u.id !== actor.id && (
                    <button
                      className="secondary"
                      disabled={!online || busy || !allowed(u)}
                      onClick={() => setToggle(u)}
                    >
                      {u.active === 1 ? (
                        <UserX size={15} />
                      ) : (
                        <UserCheck size={15} />
                      )}{" "}
                      {u.active === 1 ? "Desativar" : "Reativar"}
                    </button>
                  )}
                  <button
                    className="icon-button"
                    disabled={!online || busy}
                    aria-label={"Histórico de " + u.name}
                    onClick={async () => {
                      try {
                        setHistory(
                          await fetchJson<UserAudit[]>("/api/users?history=" + u.id),
                        );
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    <History size={16} />
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!busy && !filtered.length && (
        <p className="empty">Nenhum usuário encontrado.</p>
      )}
      {editing !== undefined && (
        <UserEditor
          actor={actor}
          target={editing || undefined}
          onClose={() => setEditing(undefined)}
          onSaved={updated}
        />
      )}
      {reset && (
        <PasswordEditor
          user={{ ...reset, mustChange: false }}
          reset
          onClose={() => setReset(null)}
          onSaved={updated}
        />
      )}
      <AlertDialog
        open={!!toggle}
        onOpenChange={(o) => {
          if (!o) setToggle(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggle?.active === 1 ? "Desativar" : "Reativar"} {toggle?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggle?.active === 1
                ? "O usuário perderá acesso ao servidor. Os lançamentos antigos serão preservados. Envios offline precisarão de reativação para serem aceitos."
                : "O usuário poderá entrar novamente com sua senha."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void deactivate();
              }}
              disabled={busy}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={history !== null}
        onOpenChange={(o) => {
          if (!o) setHistory(null);
        }}
      >
        <DialogContent className="history-dialog">
          <DialogHeader>
            <DialogTitle>Histórico do usuário</DialogTitle>
            <DialogDescription>
              Alterações de cadastro e senha, sem exibir credenciais.
            </DialogDescription>
          </DialogHeader>
          {history?.length ? (
            history.map((h) => (
              <div key={h.id} className="history-item">
                <b>
                  {h.actor_name || h.actor} ·{" "}
                  {new Date(h.at).toLocaleString("pt-BR")}
                </b>
                <p>
                  {{
                    create: "Usuário criado",
                    update: "Cadastro atualizado",
                    password_reset: "Senha redefinida",
                    password_changed: "Senha alterada",
                  }[h.action as string] || h.action}
                </p>
                {h.after && (
                  <pre className="audit-fields">
                    {JSON.stringify(JSON.parse(h.after), null, 2)}
                  </pre>
                )}
              </div>
            ))
          ) : (
            <p>Nenhuma alteração registrada.</p>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
