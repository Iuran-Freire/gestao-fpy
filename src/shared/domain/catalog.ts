export type CatalogItem = {
  id: string;
  kind: "product" | "defect";
  code: string;
  label: string;
  internal: string;
  classCc: string;
  station: string;
  sector: string;
  category: string;
  active: number;
  revision: number;
};

export function validateCatalog(input: unknown): CatalogItem {
  if (!input || typeof input !== "object") throw Error("Cadastro inválido.");
  const item = { ...input } as CatalogItem;
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(item.id) || !["product", "defect"].includes(item.kind))
    throw Error("Identificação inválida.");
  for (const key of ["code", "label", "internal", "classCc", "station", "sector", "category"] as const) {
    if (typeof item[key] !== "string" || item[key].length > 160) throw Error("Campo inválido: " + key);
    item[key] = item[key].trim();
  }
  item.code = item.code.toUpperCase();
  item.internal = item.internal.toUpperCase();
  item.classCc = item.classCc.toUpperCase();
  if (!item.code || !item.label) throw Error("Informe o código/PN e a descrição/modelo.");
  if (item.kind === "product") {
    if (!item.internal || !item.classCc) throw Error("Informe Interno e Class. CC.");
    item.station = item.sector = "";
    item.category = "";
  } else {
    if (!item.station || !item.sector || !item.category) throw Error("Informe estação, setor e categoria do defeito.");
    item.internal = item.classCc = "";
  }
  if (![0, 1].includes(item.active) || !Number.isSafeInteger(item.revision) || item.revision < 0)
    throw Error("Estado do cadastro inválido.");
  return item;
}
