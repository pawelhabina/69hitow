import { normalizeAnswer, type PublicEntry, type RevealedEntry } from "@music-crossword/shared";

export interface ProgressLike {
  solvedEntries: Record<string, RevealedEntry>;
  givenUpEntries: Record<string, RevealedEntry>;
  guesses: Record<string, string>;
}

export interface EntryCellRef {
  entry: PublicEntry;
  index: number;
}

export function cellKey(row: number, column: number) {
  return `${row}:${column}`;
}

export function getEntryCell(entry: PublicEntry, index: number) {
  return {
    row: entry.startRow + (entry.direction === "DOWN" ? index : 0),
    column: entry.startColumn + (entry.direction === "ACROSS" ? index : 0)
  };
}

export function buildEntryCellMap(entries: PublicEntry[]) {
  const cells = new Map<string, EntryCellRef[]>();
  entries.forEach((entry) => {
    Array.from({ length: entry.length }).forEach((_, index) => {
      const { row, column } = getEntryCell(entry, index);
      const key = cellKey(row, column);
      cells.set(key, [...(cells.get(key) ?? []), { entry, index }]);
    });
  });
  return cells;
}

export function getEntryLetters(entry: PublicEntry, progress: ProgressLike) {
  const reveal = progress.solvedEntries[entry.id] ?? progress.givenUpEntries[entry.id];
  if (reveal) return toLetterSlots(reveal.revealedAnswer, entry.length, false);
  return toLetterSlots(progress.guesses[entry.id] ?? "", entry.length, true);
}

export function buildCellLetters(entries: PublicEntry[], progress: ProgressLike) {
  const cells = buildEntryCellMap(entries);
  const letters: Record<string, string> = {};
  cells.forEach((refs, key) => {
    const revealed = refs
      .map(({ entry, index }) => {
        const reveal = progress.solvedEntries[entry.id] ?? progress.givenUpEntries[entry.id];
        return reveal ? toLetterSlots(reveal.revealedAnswer, entry.length, false)[index] : "";
      })
      .find(Boolean);
    const guessed = refs.map(({ entry, index }) => getEntryLetters(entry, progress)[index]).find(Boolean);
    letters[key] = revealed ?? guessed ?? "";
  });
  return letters;
}

export function writeCrossingCell(params: {
  entry: PublicEntry;
  index: number;
  letter: string;
  progress: ProgressLike;
  entryCellsByKey: Map<string, EntryCellRef[]>;
}) {
  const { row, column } = getEntryCell(params.entry, params.index);
  const related = params.entryCellsByKey.get(cellKey(row, column)) ?? [];
  const lockedLetter = findLockedLetter(related, params.progress);
  const normalizedLetter = normalizeAnswer(params.letter)[0] ?? "";
  if (lockedLetter && normalizedLetter && lockedLetter !== normalizedLetter) {
    return {
      blocked: true as const,
      lockedLetter,
      affectedEntryIds: related.map(({ entry }) => entry.id),
      guesses: params.progress.guesses
    };
  }
  return updateRelatedGuesses(related, params.progress, lockedLetter || normalizedLetter);
}

export function clearCrossingCell(params: {
  entry: PublicEntry;
  index: number;
  progress: ProgressLike;
  entryCellsByKey: Map<string, EntryCellRef[]>;
}) {
  const { row, column } = getEntryCell(params.entry, params.index);
  const related = params.entryCellsByKey.get(cellKey(row, column)) ?? [];
  const lockedLetter = findLockedLetter(related, params.progress);
  if (lockedLetter) {
    return {
      blocked: true as const,
      lockedLetter,
      affectedEntryIds: related.map(({ entry }) => entry.id),
      guesses: params.progress.guesses
    };
  }
  return updateRelatedGuesses(related, params.progress, "");
}

function updateRelatedGuesses(related: EntryCellRef[], progress: ProgressLike, letter: string) {
  const guesses = { ...progress.guesses };
  const affectedEntryIds: string[] = [];
  related.forEach(({ entry, index }) => {
    if (progress.solvedEntries[entry.id] || progress.givenUpEntries[entry.id]) return;
    const letters = getEntryLetters(entry, progress);
    letters[index] = letter;
    guesses[entry.id] = serializeLetterSlots(letters);
    affectedEntryIds.push(entry.id);
  });
  return { blocked: false as const, affectedEntryIds, guesses };
}

function findLockedLetter(related: EntryCellRef[], progress: ProgressLike) {
  return related
    .map(({ entry, index }) => {
      const reveal = progress.solvedEntries[entry.id] ?? progress.givenUpEntries[entry.id];
      return reveal ? toLetterSlots(reveal.revealedAnswer, entry.length, false)[index] : "";
    })
    .find(Boolean);
}

function toLetterSlots(value: string, length: number, preserveSlots: boolean) {
  const slots = Array<string>(length).fill("");
  const chars = [...value];
  const hasSlotMarkers = preserveSlots && chars.some((char) => char === " ");
  if (hasSlotMarkers || chars.length >= length) {
    chars.slice(0, length).forEach((char, index) => {
      slots[index] = normalizeAnswer(char)[0] ?? "";
    });
    return slots;
  }
  [...normalizeAnswer(value)].slice(0, length).forEach((letter, index) => {
    slots[index] = letter;
  });
  return slots;
}

function serializeLetterSlots(letters: string[]) {
  return letters.map((letter) => letter || " ").join("").replace(/\s+$/g, "");
}
