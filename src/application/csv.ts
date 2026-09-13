import { isoWeek, type Entry, type Group } from "../domain/fpy.ts";

export type ExportTab = "fpy" | "defects" | "production";

function cell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}

function csv(rows: unknown[][]) {
  return rows.map((row) => row.map(cell).join(";")).join("\r\n");
}

export function createCsvExport(
  tab: ExportTab,
  entries: Entry[],
  groups: Group[],
  pendingIds: Set<string>,
  year: string,
) {
  if (tab === "fpy") {
    return {
      filename: `fpy_${year}.csv`,
      content: csv([
        [
          "Data",
          "Semana ISO",
          "Ano ISO",
          "Turno",
          "Linha",
          "PN",
          "Modelo",
          "Produção",
          "Defeitos",
          "FPY (%)",
          "Situação",
        ],
        ...groups.map((g) => {
          const week = isoWeek(g.date);
          return [
            g.date.split("-").reverse().join("/"),
            week.week,
            week.year,
            g.shift,
            g.line,
            g.pn,
            g.model,
            g.production ?? "Aguardando produção",
            g.defects,
            g.issue ? "" : g.fpy === null ? "" : g.fpy.toFixed(2),
            g.issue ? "Verificar quantidades" : "OK",
          ];
        }),
      ]),
    };
  }

  const kind = tab === "defects" ? "defect" : "production";
  const selected = entries.filter((entry) => entry.kind === kind);
  const defectColumns = [
    "Código",
    "Descrição",
    "Posição mecânica",
    "Estação",
    "Categoria",
  ];
  return {
    filename: `${tab === "defects" ? "defeitos" : "producao"}_${year}.csv`,
    content: csv([
      [
        "Data",
        "Semana ISO",
        "Ano ISO",
        "Turno",
        "Linha",
        "PN",
        "Modelo",
        ...(kind === "defect" ? defectColumns : []),
        "Quantidade",
        "Responsável",
        "Estado",
      ],
      ...selected.map((entry) => {
        const week = isoWeek(entry.date);
        return [
          entry.date.split("-").reverse().join("/"),
          week.week,
          week.year,
          entry.shift,
          entry.line,
          entry.pn,
          entry.model,
          ...(kind === "defect"
            ? [
                entry.code,
                entry.description,
                entry.position,
                entry.station,
                entry.category,
              ]
            : []),
          entry.quantity,
          entry.author,
          pendingIds.has(entry.id) ? "Pendente" : "Sincronizado",
        ];
      }),
    ]),
  };
}

export function downloadCsv(filename: string, content: string) {
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
