"use client";

import { toRomanLower } from "../../lib/roman";

type Props = {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
};

export function FolioPager({ page, pageCount, onChange }: Props) {
  const safePageCount = Math.max(1, pageCount);
  const safePage = Math.min(Math.max(1, page), safePageCount);
  const prevDisabled = safePage <= 1;
  const nextDisabled = safePage >= safePageCount;
  return (
    <nav className="folio-pager" aria-label="Pagination">
      <button
        type="button"
        className="nav ghost"
        onClick={() => onChange(safePage - 1)}
        disabled={prevDisabled}
        aria-label="Previous folio"
      >
        &lsaquo;
      </button>
      <span className="label">
        Folio <em>{toRomanLower(safePage)}</em> of <em>{toRomanLower(safePageCount)}</em>
      </span>
      <button
        type="button"
        className="nav ghost"
        onClick={() => onChange(safePage + 1)}
        disabled={nextDisabled}
        aria-label="Next folio"
      >
        &rsaquo;
      </button>
    </nav>
  );
}
