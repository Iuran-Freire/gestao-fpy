"use client";
import { KeyRound, LogOut, Pencil, UserRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/src/frontend/components/ui/dialog";
import type { User } from "@/src/shared/domain/fpy";

const roleLabel: Record<User["role"], string> = {
  operador: "Operador",
  supervisor: "Supervisor",
  lider: "Líder",
  tecnica: "Técnica",
  qualidade: "Qualidade",
  engenharia: "Engenharia",
};

export function Profile({
  user,
  onClose,
  onEdit,
  onPassword,
  onLogout,
  online,
}: {
  user: User;
  onClose: () => void;
  onEdit: () => void;
  onPassword: () => void;
  onLogout: () => void;
  online: boolean;
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="profile-dialog">
        <DialogHeader>
          <DialogTitle>Meu perfil</DialogTitle>
          <DialogDescription>Dados da sua conta no Gestão de FPY.</DialogDescription>
        </DialogHeader>
        <div className="profile-identity">
          <span className="profile-avatar"><UserRound size={28} aria-hidden="true" /></span>
          <div>
            <strong>{user.name}</strong>
            <span>{user.owner ? "Administrador principal" : roleLabel[user.role]}</span>
          </div>
        </div>
        <dl className="profile-details">
          <div><dt>Usuário</dt><dd>{user.username || "Não informado"}</dd></div>
          <div><dt>E-mail</dt><dd>{user.email || "Não informado"}</dd></div>
          <div><dt>Nível de acesso</dt><dd>{user.owner ? "Administrador principal" : roleLabel[user.role]}</dd></div>
        </dl>
        <div className="profile-actions">
          <button type="button" className="secondary" onClick={onEdit} disabled={!online}>
            <Pencil size={17} aria-hidden="true" /> Editar dados
          </button>
          <button type="button" className="secondary" onClick={onPassword} disabled={!online}>
            <KeyRound size={17} aria-hidden="true" /> Alterar senha
          </button>
          <button type="button" className="profile-logout" onClick={onLogout} disabled={!online}>
            <LogOut size={17} aria-hidden="true" /> Sair da conta
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
