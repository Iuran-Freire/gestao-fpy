"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { validateEntry, type Entry, type User } from "@/src/domain/fpy";
export function Choice({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string }[];
}) {
  return (
    <label>
      {label}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label} className="choice">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem value={i.value} key={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
const codes = [
  ["SMT02", "Componente com solda insuficiente"],
  ["SMT04", "Componente com curto de solda"],
  ["SMT06", "Componente com tombstone"],
  ["SMT07", "Componente ausente"],
  ["SMT08", "Componente invertido"],
  ["SMT09", "Componente deslocado"],
  ["SMT15", "Adesivo insuficiente"],
  ["SMT16", "Excesso de adesivo"],
];
const today = () => new Date().toLocaleDateString("en-CA");
export function EntryForm({
  kind,
  editing,
  user,
  entries,
  onClose,
  onSave,
}: {
  kind: "production" | "defect";
  editing?: Entry;
  user: User;
  entries: Entry[];
  onClose: () => void;
  onSave: (
    entries: Entry[],
    edit?: { revision: number; reason: string },
  ) => Promise<void>;
}) {
  const [context, setContext] = useState(() => {
      let previous: Record<string, string> = {};
      try {
        previous = JSON.parse(localStorage.getItem("fpy-context") || "{}");
      } catch {
        /* Preferences are optional. */
      }
      return {
        date: editing?.date || today(),
        shift: editing?.shift || previous.shift || "1",
        line: editing?.line || previous.line || "",
        pn: editing?.pn || previous.pn || "",
        model: editing?.model || previous.model || "",
        station: editing?.station || previous.station || "SMT PROCESS",
        category: editing?.category || previous.category || "SMT",
      };
    }),
    [items, setItems] = useState([
      {
        quantity: String(editing?.quantity ?? ""),
        code: editing?.code || "",
        description: editing?.description || "",
        position: editing?.position || "",
      },
    ]),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const models = [
    ...new Map(
      entries.map((e) => [
        e.pn,
        { value: e.pn, label: e.pn + " · " + e.model },
      ]),
    ).values(),
  ];
  const [newModel, setNewModel] = useState(
    !models.length || !!editing || !models.some((m) => m.value === context.pn),
  );
  function field(key: keyof typeof context, value: string) {
    setContext({ ...context, [key]: value });
  }
  function itemField(index: number, key: string, value: string) {
    setItems(
      items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    );
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const records = items.map((i) =>
        validateEntry({
          ...context,
          ...i,
          id: editing?.id || crypto.randomUUID(),
          kind,
          quantity: Number(i.quantity),
          author: editing?.author || user.name,
          createdAt: editing?.createdAt || now,
          updatedAt: now,
          revision: editing?.revision || 1,
        }),
      );
      if (items.some((i) => i.quantity.trim() === ""))
        throw Error("Informe a quantidade.");
      if (editing && !reason.trim())
        throw Error("Informe o motivo da correção.");
      await onSave(
        records,
        editing ? { revision: editing.revision, reason } : undefined,
      );
      try {
        localStorage.setItem("fpy-context", JSON.stringify(context));
      } catch {
        /* The durable entry is already saved. */
      }
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="entry-dialog">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? "Corrigir registro"
              : kind === "production"
                ? "Informar produção"
                : "Lançar defeitos"}
          </DialogTitle>
          <DialogDescription>
            {kind === "production"
              ? "Um único total por data, turno, linha e PN."
              : "Selecione a produção e adicione os defeitos encontrados."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <div className="form-section">
            <h3>Identificação da produção</h3>
            <div className="form-grid">
              <label>
                Data
                <input
                  type="date"
                  required
                  value={context.date}
                  onChange={(e) => field("date", e.target.value)}
                />
              </label>
              <Choice
                label="Turno"
                value={context.shift}
                onChange={(v) => field("shift", v)}
                items={["1", "2", "3"].map((v) => ({
                  value: v,
                  label: v + "º turno",
                }))}
              />
              <label>
                Linha
                <input
                  required
                  maxLength={160}
                  placeholder="Ex.: SMT-1"
                  value={context.line}
                  onChange={(e) => field("line", e.target.value)}
                />
              </label>
              {!newModel ? (
                <Choice
                  label="Produto / modelo"
                  value={context.pn}
                  onChange={(v) =>
                    setContext({
                      ...context,
                      pn: v,
                      model: entries.find((e) => e.pn === v)!.model,
                    })
                  }
                  items={models}
                />
              ) : (
                <>
                  <label>
                    PN do produto
                    <input
                      required
                      maxLength={160}
                      placeholder="Ex.: 24N070-0"
                      value={context.pn}
                      onChange={(e) => field("pn", e.target.value)}
                    />
                  </label>
                  <label>
                    Modelo / descrição do PN
                    <input
                      required
                      maxLength={160}
                      placeholder="Ex.: TITAN 4C"
                      value={context.model}
                      onChange={(e) => field("model", e.target.value)}
                    />
                  </label>
                </>
              )}
            </div>
            {models.length > 0 && (
              <button
                type="button"
                className="text-button"
                onClick={() => setNewModel(!newModel)}
              >
                {newModel
                  ? "Selecionar modelo já registrado"
                  : "Informar outro produto / modelo"}
              </button>
            )}
          </div>
          {kind === "defect" && (
            <div className="form-grid">
              <label>
                Estação
                <input
                  maxLength={160}
                  value={context.station}
                  onChange={(e) => field("station", e.target.value)}
                />
              </label>
              <label>
                Categoria
                <input
                  maxLength={160}
                  value={context.category}
                  onChange={(e) => field("category", e.target.value)}
                />
              </label>
            </div>
          )}
          <div className="form-section">
            <h3>
              {kind === "production"
                ? "Total produzido no turno"
                : "Defeitos da primeira passagem"}
            </h3>
            {items.map((item, index) => (
              <div key={index} className="defect-item">
                {kind === "defect" && (
                  <div className="item-title">
                    <b>Defeito {index + 1}</b>
                    {items.length > 1 && (
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={"Remover defeito " + (index + 1)}
                        onClick={() =>
                          setItems(items.filter((_, i) => i !== index))
                        }
                      >
                        <Trash2 size={17} />
                      </button>
                    )}
                  </div>
                )}
                <div className="form-grid">
                  <label>
                    Quantidade
                    <input
                      type="number"
                      inputMode="numeric"
                      min={kind === "production" ? 0 : 1}
                      max={10000000}
                      step="1"
                      required
                      value={item.quantity}
                      onChange={(e) =>
                        itemField(index, "quantity", e.target.value)
                      }
                    />
                  </label>
                  {kind === "defect" && (
                    <>
                      <Choice
                        label="Código do defeito"
                        value={
                          codes.some((c) => c[0] === item.code)
                            ? item.code
                            : "custom"
                        }
                        onChange={(v) => {
                          const found = codes.find((c) => c[0] === v);
                          setItems(
                            items.map((it, i) =>
                              i === index
                                ? {
                                    ...it,
                                    code: found?.[0] || "",
                                    description: found?.[1] || "",
                                  }
                                : it,
                            ),
                          );
                        }}
                        items={[
                          { value: "custom", label: "Informar código" },
                          ...codes.map(([v, l]) => ({
                            value: v,
                            label: v + " · " + l,
                          })),
                        ]}
                      />
                      {!codes.some((c) => c[0] === item.code) && (
                        <label>
                          Código
                          <input
                            required
                            maxLength={160}
                            value={item.code}
                            onChange={(e) =>
                              itemField(index, "code", e.target.value)
                            }
                          />
                        </label>
                      )}
                      <label>
                        Posição mecânica
                        <input
                          required
                          maxLength={160}
                          placeholder="Ex.: U2, R24, C1"
                          value={item.position}
                          onChange={(e) =>
                            itemField(index, "position", e.target.value)
                          }
                        />
                      </label>
                      <label>
                        Descrição do defeito
                        <input
                          maxLength={160}
                          value={item.description}
                          onChange={(e) =>
                            itemField(index, "description", e.target.value)
                          }
                        />
                      </label>
                    </>
                  )}
                </div>
              </div>
            ))}
            {kind === "defect" && !editing && (
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setItems([
                    ...items,
                    { quantity: "", code: "", description: "", position: "" },
                  ])
                }
              >
                <Plus size={17} /> Adicionar outro defeito
              </button>
            )}
          </div>
          {editing && (
            <label>
              Motivo da correção
              <input
                required
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          )}
          <p className="form-hint">
            Responsável: {user.name}.{" "}
            {kind === "defect"
              ? "Cada peça deve ser contada uma única vez."
              : "O total informado será usado no cálculo do FPY."}
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="form-footer">
            <button
              type="button"
              className="secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button disabled={saving} type="submit">
              {saving
                ? "Salvando…"
                : editing
                  ? "Salvar correção"
                  : kind === "production"
                    ? "Salvar produção"
                    : "Salvar " +
                      items.length +
                      " lançamento" +
                      (items.length > 1 ? "s" : "")}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
