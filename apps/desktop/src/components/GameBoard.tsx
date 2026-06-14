import {
  type Direction,
  type LetterCheckStatus,
  type PublicCrossword,
  type PublicEntry,
  type RevealedEntry
} from "@music-crossword/shared";
import { cn } from "@/lib/utils";

interface Props {
  crossword: PublicCrossword;
  activeEntryId: string;
  progress: {
    solvedEntries: Record<string, RevealedEntry>;
    givenUpEntries: Record<string, RevealedEntry>;
    guesses: Record<string, string>;
  };
  feedback: Record<string, LetterCheckStatus[]>;
  cellLetters: Record<string, string>;
  activeCellIndex: number;
  onSelect: (entry: PublicEntry, cellIndex: number, directionHint?: Direction) => void;
}

export function GameBoard({ crossword, activeEntryId, progress, feedback, cellLetters, activeCellIndex, onSelect }: Props) {
  const cells = new Map<
    string,
    {
      entries: Array<{ entry: PublicEntry; index: number }>;
      statuses: Array<{ entryId: string; status: LetterCheckStatus }>;
    }
  >();

  crossword.entries.forEach((entry) => {
    Array.from({ length: entry.length }).forEach((_, index) => {
      const row = entry.startRow + (entry.direction === "DOWN" ? index : 0);
      const column = entry.startColumn + (entry.direction === "ACROSS" ? index : 0);
      const key = `${row}:${column}`;
      const current = cells.get(key) ?? { entries: [], statuses: [] };
      current.entries.push({ entry, index });
      const status = feedback[entry.id]?.[index];
      if (status) current.statuses.push({ entryId: entry.id, status });
      cells.set(key, current);
    });
  });

  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${crossword.gridColumns}, minmax(0, 1fr))` }}>
      {Array.from({ length: crossword.gridRows * crossword.gridColumns }).map((_, index) => {
        const row = Math.floor(index / crossword.gridColumns);
        const column = index % crossword.gridColumns;
        const cell = cells.get(`${row}:${column}`);
        const active = cell?.entries.some(({ entry }) => entry.id === activeEntryId);
        const activeCell = cell?.entries.some(({ entry, index: entryIndex }) => entry.id === activeEntryId && entryIndex === activeCellIndex);
        const solved = cell?.entries.some(({ entry }) => progress.solvedEntries[entry.id]);
        const givenUp = cell?.entries.some(({ entry }) => progress.givenUpEntries[entry.id]);
        const letter = cellLetters[`${row}:${column}`] ?? "";
        const activeStatus = cell?.statuses.find((item) => item.entryId === activeEntryId)?.status;
        const status = activeStatus ?? cell?.statuses.find((item) => item.status !== "correct")?.status ?? cell?.statuses[0]?.status;
        return (
          <button
            key={`${row}:${column}`}
            type="button"
            data-cell-key={`${row}:${column}`}
            aria-label={cell ? `Kratka ${row + 1}, ${column + 1}${letter ? `, ${letter}` : ""}` : `Puste pole ${row + 1}, ${column + 1}`}
            disabled={!cell}
            onClick={() => {
              if (!cell) return;
              const currentIndex = Math.max(0, cell.entries.findIndex(({ entry }) => entry.id === activeEntryId));
              const clickedActiveCell = cell.entries[currentIndex]?.entry.id === activeEntryId && cell.entries[currentIndex]?.index === activeCellIndex;
              const selected = clickedActiveCell && cell.entries.length > 1 ? cell.entries[(currentIndex + 1) % cell.entries.length] : cell.entries[currentIndex];
              onSelect(selected.entry, selected.index, selected.entry.direction);
            }}
            className={cn(
              "relative aspect-square rounded-[6px] border text-center text-sm font-black transition",
              cell
                ? "border-white/15 bg-slate-900/80 text-white hover:border-cyan/60"
                : "border-white/[0.03] bg-black/45 text-transparent",
              active && "border-cyan/70 bg-gradient-to-br from-cyan/35 to-violet/20 shadow-glow",
              activeCell && "ring-2 ring-cyan ring-offset-2 ring-offset-slate-950",
              status === "correct" && "border-emerald-300/70 bg-emerald-500/25 text-emerald-50",
              (status === "incorrect" || status === "missing") && "border-red-300/70 bg-red-500/25 text-red-50",
              solved && "border-emerald-300/50 bg-emerald-500/18 text-emerald-50",
              givenUp && !solved && "border-slate-400/30 bg-slate-500/20 text-slate-200"
            )}
          >
            {letter}
            {cell?.entries.length && cell.entries.some(({ entry }) => entry.startRow === row && entry.startColumn === column) ? (
              <span className="absolute left-1 top-0.5 text-[9px] font-semibold text-slate-400">
                {cell.entries.find(({ entry }) => entry.startRow === row && entry.startColumn === column)?.entry.orderNumber}
              </span>
            ) : null}
            {cell && cell.entries.length > 1 ? <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-cyan" /> : null}
          </button>
        );
      })}
    </div>
  );
}
