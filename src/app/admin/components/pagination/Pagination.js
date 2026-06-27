import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./Pagination.module.css";

/**
 * Reusable Prev/Next pagination bar.
 *
 * Props:
 *  - page        current page number (1-indexed)
 *  - pageSize     how many rows per page (e.g. 50)
 *  - totalCount   total rows across ALL pages (from backend `count`)
 *  - hasNext      boolean — backend told us there's a next page
 *  - hasPrevious  boolean — backend told us there's a previous page
 *  - loading      boolean — disables buttons while a page is being fetched
 *  - onPageChange (newPage) => void
 */
export default function Pagination({
  page,
  pageSize,
  totalCount,
  hasNext,
  hasPrevious,
  loading,
  onPageChange,
}) {
  if (!totalCount || totalCount <= pageSize) return null; // nothing to paginate

  const totalPages = Math.ceil(totalCount / pageSize);
  const startItem  = (page - 1) * pageSize + 1;
  const endItem    = Math.min(page * pageSize, totalCount);

  return (
    <div className={styles.wrap}>
      <span className={styles.summary}>
        Showing <strong>{startItem}–{endItem}</strong> of <strong>{totalCount}</strong>
      </span>

      <div className={styles.controls}>
        <button
          className={styles.navBtn}
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrevious || loading}
        >
          <ChevronLeft size={14} strokeWidth={2} />
          Prev
        </button>

        <span className={styles.pageLabel}>
          Page {page} of {totalPages}
        </span>

        <button
          className={styles.navBtn}
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext || loading}
        >
          Next
          <ChevronRight size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}