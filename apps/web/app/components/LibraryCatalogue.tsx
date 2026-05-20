"use client";

import { toRomanLower } from "../../lib/roman";

export type CatalogueRow = {
  id: string;
  name: string;
  degree: string;
  major?: string;
  year?: string;
  revoked?: boolean;
};

type Props = {
  rows: CatalogueRow[];
  selectedId?: string;
  onSelect: (id: string) => void;
  viewMode: "cards" | "list";
  onChangeViewMode: (mode: "cards" | "list") => void;
  search: string;
  onSearch: (value: string) => void;
  statusFilter: "all" | "active" | "revoked";
  onStatusFilter: (status: "all" | "active" | "revoked") => void;
  loading?: boolean;
  emptyText?: string;
};

export function LibraryCatalogue({
  rows,
  selectedId,
  onSelect,
  viewMode,
  onChangeViewMode,
  search,
  onSearch,
  statusFilter,
  onStatusFilter,
  loading,
  emptyText,
}: Props) {
  return (
    <div className="catalogue-wrap">
      <div className="catalogue-controls">
        <label className="catalogue-search">
          <span>Search</span>
          <input
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="By degree, year, or institution"
          />
        </label>
        <label className="catalogue-status">
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => onStatusFilter(event.target.value as Props["statusFilter"])}>
            <option value="all">All</option>
            <option value="active">In good standing</option>
            <option value="revoked">Revoked</option>
          </select>
        </label>
        <div className="catalogue-view">
          <button
            type="button"
            className={`ghost ${viewMode === "cards" ? "is-active" : ""}`}
            onClick={() => onChangeViewMode("cards")}
          >
            Card View
          </button>
          <span aria-hidden="true">⁂</span>
          <button
            type="button"
            className={`ghost ${viewMode === "list" ? "is-active" : ""}`}
            onClick={() => onChangeViewMode("list")}
          >
            Catalogue View
          </button>
        </div>
      </div>
      {loading ? (
        <p className="marginalia loading"><em>Consulting the library&apos;s catalogue…</em></p>
      ) : rows.length === 0 ? (
        <p className="marginalia"><em>{emptyText ?? "The library awaits its first volume."}</em></p>
      ) : viewMode === "cards" ? (
        <div className="grid cols-3 catalogue cards">
          {rows.map((row, idx) => (
            <button
              type="button"
              key={row.id}
              className={`catalogue-card ${selectedId === row.id ? "active" : ""}`}
              onClick={() => onSelect(row.id)}
            >
              <span className="folio-num">{toRomanLower(idx + 1)}.</span>
              <span className="holder-name">{row.name}</span>
              <span className="degree">{row.degree}</span>
              {row.major ? <span className="major">{row.major}</span> : null}
              <span className="year">{row.year ?? ""}</span>
              {row.revoked ? <span className="badge revoked">revoked</span> : null}
            </button>
          ))}
        </div>
      ) : (
        <dl className="catalogue list">
          {rows.map((row, idx) => (
            <button
              type="button"
              key={row.id}
              className={`catalogue-row ${selectedId === row.id ? "active" : ""}`}
              onClick={() => onSelect(row.id)}
            >
              <span className="folio-num">{toRomanLower(idx + 1)}.</span>
              <span className="holder-stack">
                <span className="degree">{row.degree}</span>
                <span className="holder-name">{row.name}</span>
              </span>
              <span className="year">{row.year ?? ""}</span>
              {row.revoked ? <span className="badge revoked">revoked</span> : null}
            </button>
          ))}
        </dl>
      )}
    </div>
  );
}
