import { useMemo, useState, type DragEvent } from "react";
import { Music2 } from "lucide-react";
import type { Direction } from "@music-crossword/shared";
import { normalizeAnswer } from "@music-crossword/shared";
import { cn } from "@/lib/utils";
import type { AdminEntry } from "@/types";

interface PreviewEntry {
  answer: string;
  direction: Direction;
  startRow: number;
  startColumn: number;
}

interface Props {
  rows: number;
  columns: number;
  entries: AdminEntry[];
  activeEntryId?: string | null;
  draft?: PreviewEntry | null;
  showAnswers?: boolean;
  onEntryClick?: (entry: AdminEntry) => void;
  onEntryMove?: (entry: AdminEntry, startRow: number, startColumn: number) => void;
}

interface DragState {
  entry: AdminEntry;
  letterIndex: number;
}

export function AdminGrid({ rows, columns, entries, activeEntryId, draft, showAnswers = true, onEntryClick, onEntryMove }: Props) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragTarget, setDragTarget] = useState<{ row: number; column: number } | null>(null);
  const cells = new Map<string, { letters: string[]; entries: Array<{ entry: AdminEntry; index: number }>; draft?: boolean }>();

  entries.forEach((entry) => {
    [...entry.normalizedAnswer].forEach((letter, index) => {
      const row = entry.startRow + (entry.direction === "DOWN" ? index : 0);
      const column = entry.startColumn + (entry.direction === "ACROSS" ? index : 0);
      const key = `${row}:${column}`;
      const current = cells.get(key) ?? { letters: [], entries: [] };
      current.letters.push(letter);
      current.entries.push({ entry, index });
      cells.set(key, current);
    });
  });

  const dragPreview = useMemo(() => {
    if (!dragState || !dragTarget) return null;
    return {
      answer: dragState.entry.answer,
      direction: dragState.entry.direction,
      startRow: dragTarget.row - (dragState.entry.direction === "DOWN" ? dragState.letterIndex : 0),
      startColumn: dragTarget.column - (dragState.entry.direction === "ACROSS" ? dragState.letterIndex : 0)
    };
  }, [dragState, dragTarget]);

  const invalidCells = new Set<string>();
  const keyOf = (row: number, column: number) => `${row}:${column}`;
  const markInvalid = (row: number, column: number) => {
    if (row >= 0 && column >= 0 && row < rows && column < columns) invalidCells.add(keyOf(row, column));
  };
  const getCellWithoutIgnoredEntry = (row: number, column: number, ignoredEntryId?: string) => {
    const cell = cells.get(keyOf(row, column));
    if (!cell || !ignoredEntryId) return cell;
    const entriesWithoutIgnored = cell.entries.filter(({ entry }) => entry.id !== ignoredEntryId);
    if (!entriesWithoutIgnored.length) return undefined;
    return {
      letters: entriesWithoutIgnored.map(({ entry, index }) => entry.normalizedAnswer[index]),
      entries: entriesWithoutIgnored
    };
  };

  const markPreviewErrors = (preview: PreviewEntry, ignoredEntryId?: string) => {
    const normalizedPreview = normalizeAnswer(preview.answer);
    const oppositeDirection: Direction = preview.direction === "ACROSS" ? "DOWN" : "ACROSS";

    [...normalizedPreview].forEach((letter, index) => {
      const row = preview.startRow + (preview.direction === "DOWN" ? index : 0);
      const column = preview.startColumn + (preview.direction === "ACROSS" ? index : 0);
      const existingCell = getCellWithoutIgnoredEntry(row, column, ignoredEntryId);

      if (row < 0 || column < 0 || row >= rows || column >= columns) {
        markInvalid(row, column);
        return;
      }

      if (existingCell && !existingCell.letters.every((existingLetter) => existingLetter === letter)) {
        markInvalid(row, column);
      }

      if (existingCell?.entries.some(({ entry }) => entry.direction === preview.direction)) {
        markInvalid(row, column);
      }

      const hasValidCrossing =
        existingCell?.entries.some(({ entry }) => entry.direction === oppositeDirection) &&
        existingCell.letters.every((existingLetter) => existingLetter === letter);
      const sideNeighbors =
        preview.direction === "ACROSS"
          ? [
              [row - 1, column],
              [row + 1, column]
            ]
          : [
              [row, column - 1],
              [row, column + 1]
            ];

      if (!hasValidCrossing) {
        sideNeighbors.forEach(([neighborRow, neighborColumn]) => {
          if (getCellWithoutIgnoredEntry(neighborRow, neighborColumn, ignoredEntryId)) {
            markInvalid(row, column);
            markInvalid(neighborRow, neighborColumn);
          }
        });
      }
    });

    const endRow = preview.startRow + (preview.direction === "DOWN" ? normalizedPreview.length - 1 : 0);
    const endColumn = preview.startColumn + (preview.direction === "ACROSS" ? normalizedPreview.length - 1 : 0);
    const beforeRow = preview.startRow - (preview.direction === "DOWN" ? 1 : 0);
    const beforeColumn = preview.startColumn - (preview.direction === "ACROSS" ? 1 : 0);
    const afterRow = endRow + (preview.direction === "DOWN" ? 1 : 0);
    const afterColumn = endColumn + (preview.direction === "ACROSS" ? 1 : 0);

    [
      [beforeRow, beforeColumn, preview.startRow, preview.startColumn],
      [afterRow, afterColumn, endRow, endColumn]
    ].forEach(([neighborRow, neighborColumn, ownRow, ownColumn]) => {
      if (getCellWithoutIgnoredEntry(neighborRow, neighborColumn, ignoredEntryId)) {
        markInvalid(neighborRow, neighborColumn);
        markInvalid(ownRow, ownColumn);
      }
    });
  };

  cells.forEach((cell, key) => {
    if (new Set(cell.letters).size > 1) invalidCells.add(key);
    if (cell.entries.some(({ entry }, index) => cell.entries.some(({ entry: otherEntry }, otherIndex) => otherIndex > index && otherEntry.direction === entry.direction))) {
      invalidCells.add(key);
    }
  });

  entries.forEach((entry) => {
    [...entry.normalizedAnswer].forEach((_letter, index) => {
      const row = entry.startRow + (entry.direction === "DOWN" ? index : 0);
      const column = entry.startColumn + (entry.direction === "ACROSS" ? index : 0);
      const ownCell = cells.get(keyOf(row, column));
      const hasValidCrossing = ownCell?.entries.some(({ entry: otherEntry }) => otherEntry.direction !== entry.direction) ?? false;
      const sideNeighbors =
        entry.direction === "ACROSS"
          ? [
              [row - 1, column],
              [row + 1, column]
            ]
          : [
              [row, column - 1],
              [row, column + 1]
            ];

      if (!hasValidCrossing) {
        sideNeighbors.forEach(([neighborRow, neighborColumn]) => {
          if (cells.has(keyOf(neighborRow, neighborColumn))) {
            markInvalid(row, column);
            markInvalid(neighborRow, neighborColumn);
          }
        });
      }
    });

    const endRow = entry.startRow + (entry.direction === "DOWN" ? entry.normalizedAnswer.length - 1 : 0);
    const endColumn = entry.startColumn + (entry.direction === "ACROSS" ? entry.normalizedAnswer.length - 1 : 0);
    const beforeRow = entry.startRow - (entry.direction === "DOWN" ? 1 : 0);
    const beforeColumn = entry.startColumn - (entry.direction === "ACROSS" ? 1 : 0);
    const afterRow = endRow + (entry.direction === "DOWN" ? 1 : 0);
    const afterColumn = endColumn + (entry.direction === "ACROSS" ? 1 : 0);

    [
      [beforeRow, beforeColumn, entry.startRow, entry.startColumn],
      [afterRow, afterColumn, endRow, endColumn]
    ].forEach(([neighborRow, neighborColumn, ownRow, ownColumn]) => {
      if (cells.has(keyOf(neighborRow, neighborColumn))) {
        markInvalid(neighborRow, neighborColumn);
        markInvalid(ownRow, ownColumn);
      }
    });
  });

  if (draft?.answer) markPreviewErrors(draft);
  if (dragPreview) markPreviewErrors(dragPreview, dragState?.entry.id);

  [draft, dragPreview].forEach((preview) => {
    if (!preview?.answer) return;
    [...normalizeAnswer(preview.answer)].forEach((letter, index) => {
      const row = preview.startRow + (preview.direction === "DOWN" ? index : 0);
      const column = preview.startColumn + (preview.direction === "ACROSS" ? index : 0);
      const key = `${row}:${column}`;
      const current = cells.get(key) ?? { letters: [], entries: [] };
      current.letters.push(letter);
      current.draft = true;
      cells.set(key, current);
    });
  });

  const finishDrag = () => {
    setDragState(null);
    setDragTarget(null);
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>, row: number, column: number) => {
    event.preventDefault();
    if (!dragState) return;
    const startRow = row - (dragState.entry.direction === "DOWN" ? dragState.letterIndex : 0);
    const startColumn = column - (dragState.entry.direction === "ACROSS" ? dragState.letterIndex : 0);
    onEntryMove?.(dragState.entry, startRow, startColumn);
    finishDrag();
  };

  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {Array.from({ length: rows * columns }).map((_, index) => {
        const row = Math.floor(index / columns);
        const column = index % columns;
        const cell = cells.get(`${row}:${column}`);
        const firstEntry = cell?.entries[0];
        const dragEntry = cell?.entries.find(({ entry }) => entry.id === activeEntryId) ?? firstEntry;
        const isActive = cell?.entries.some(({ entry }) => entry.id === activeEntryId);
        const hasConflict = invalidCells.has(`${row}:${column}`);
        return (
          <button
            key={`${row}:${column}`}
            type="button"
            tabIndex={firstEntry ? 0 : -1}
            aria-disabled={!firstEntry}
            draggable={Boolean(dragEntry)}
            onClick={() => firstEntry && onEntryClick?.(firstEntry.entry)}
            onDragStart={(event) => {
              if (!dragEntry) return;
              setDragState({ entry: dragEntry.entry, letterIndex: dragEntry.index });
              setDragTarget({ row, column });
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", dragEntry.entry.id);
            }}
            onDragOver={(event) => {
              if (!dragState) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDragTarget({ row, column });
            }}
            onDrop={(event) => handleDrop(event, row, column)}
            onDragEnd={finishDrag}
            className={cn(
              "relative aspect-square rounded-[5px] border text-center text-xs font-bold transition",
              cell
                ? "cursor-grab border-white/15 bg-slate-800/80 text-white hover:border-cyan/70 active:cursor-grabbing"
                : "border-white/[0.04] bg-black/45 text-transparent",
              isActive && "border-cyan/70 bg-cyan/20 shadow-glow",
              cell?.draft && "border-violet/80 bg-violet/20",
              hasConflict && "border-red-400 bg-red-500/35 text-red-50"
            )}
          >
            {cell && showAnswers ? cell.letters[0] : null}
            {cell?.entries.length && !showAnswers ? <Music2 className="mx-auto h-3.5 w-3.5 text-slate-400" /> : null}
            {cell?.entries.length && cell.entries.length > 1 ? (
              <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-cyan" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
