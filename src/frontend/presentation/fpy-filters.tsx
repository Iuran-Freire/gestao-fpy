import { Download, RotateCcw, Search } from "lucide-react";

type Props = {
  range: { from: string; to: string };
  shift: string;
  line: string;
  lines: string[];
  search: string;
  defects: boolean;
  count: number;
  unavailable: boolean;
  error: string;
  onRange: (value: { from: string; to: string }) => void;
  onShift: (value: string) => void;
  onLine: (value: string) => void;
  onSearch: (value: string) => void;
  onReset: () => void;
  onExport: () => void;
};

export function FpyFilters(props: Props) {
  const displayDate = (value: string) => value.split("-").reverse().join("/");
  return (
    <section className="fpy-filters panel" aria-label="Filtros da tabela">
      <div className="fpy-filter-fields">
        <label>Data inicial<input type="date" value={props.range.from} aria-invalid={Boolean(props.error)}
          onChange={(event) => props.onRange({ ...props.range, from: event.target.value })} /></label>
        <label>Data final<input type="date" value={props.range.to} aria-invalid={Boolean(props.error)}
          onChange={(event) => props.onRange({ ...props.range, to: event.target.value })} /></label>
        <label>Turno
          <select value={props.shift} onChange={(event) => props.onShift(event.target.value)}>
            <option value="all">Todos</option>
            {["1", "2", "3"].map((shift) => <option key={shift} value={shift}>{shift}º turno</option>)}
          </select>
        </label>
        <label>Linha
          <select value={props.line} onChange={(event) => props.onLine(event.target.value)}>
            <option value="all">Todas</option>
            {props.lines.map((line) => <option key={line} value={line}>{line}</option>)}
          </select>
        </label>
        <label className="fpy-search">Buscar
          <span className="fpy-search-input"><Search size={17} aria-hidden="true" />
            <input type="search" value={props.search}
              placeholder={props.defects ? "PN, modelo, defeito ou posição" : "PN ou modelo"}
              onChange={(event) => props.onSearch(event.target.value)} />
          </span>
        </label>
      </div>
      <div className="fpy-filter-footer">
        <p aria-live="polite">
          {props.error || <><span>{displayDate(props.range.from)} a {displayDate(props.range.to)}</span>
            {!props.unavailable && <> · <b>{props.count.toLocaleString("pt-BR")}</b> resultados</>}</>}
        </p>
        <div className="fpy-filter-actions">
          <button type="button" className="text-button" onClick={props.onReset}><RotateCcw size={15} /> Limpar filtros</button>
          <button type="button" className="secondary" onClick={props.onExport} disabled={props.unavailable || Boolean(props.error) || props.count === 0}>
            <Download size={17} /> Exportar CSV
          </button>
        </div>
      </div>
    </section>
  );
}
