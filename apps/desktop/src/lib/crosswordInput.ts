import {
  normalizeAnswer,
  type LetterCheckStatus,
  type PublicEntry,
  type RevealedEntry
} from "@music-crossword/shared";

export interface ProgressLike {
  solvedEntries: Record<string, RevealedEntry>;
  givenUpEntries: Record<string, RevealedEntry>;
  guesses: Record<string, string>;
}

export interface EntryCellRef {
  entry: PublicEntry;
  index: number;
}

export type BoardFeedback = Record<string, LetterCheckStatus[]>;

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
  if (reveal) return toLetterSlots(normalizeAnswer(reveal.revealedAnswer), entry.length, false);
  return toLetterSlots(progress.guesses[entry.id] ?? "", entry.length, true);
}

export function buildCellLetters(entries: PublicEntry[], progress: ProgressLike) {
  const cells = buildEntryCellMap(entries);
  const letters: Record<string, string> = {};
  cells.forEach((refs, key) => {
    const revealed = refs
      .map(({ entry, index }) => {
        const reveal = progress.solvedEntries[entry.id] ?? progress.givenUpEntries[entry.id];
        return reveal ? toLetterSlots(normalizeAnswer(reveal.revealedAnswer), entry.length, false)[index] : "";
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
  feedback?: BoardFeedback;
}) {
  const { row, column } = getEntryCell(params.entry, params.index);
  const related = params.entryCellsByKey.get(cellKey(row, column)) ?? [];
  const lockedLetter = findLockedLetter(related, params.progress, params.feedback);
  const normalizedLetter = normalizeAnswer(params.letter)[0] ?? "";
  if (lockedLetter) {
    return {
      blocked: lockedLetter !== normalizedLetter,
      unchanged: lockedLetter === normalizedLetter,
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
  feedback?: BoardFeedback;
}) {
  const { row, column } = getEntryCell(params.entry, params.index);
  const related = params.entryCellsByKey.get(cellKey(row, column)) ?? [];
  const lockedLetter = findLockedLetter(related, params.progress, params.feedback);
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

export function getLockedCellLetter(params: {
  entry: PublicEntry;
  index: number;
  progress: ProgressLike;
  entryCellsByKey: Map<string, EntryCellRef[]>;
  feedback?: BoardFeedback;
}) {
  const { row, column } = getEntryCell(params.entry, params.index);
  const related = params.entryCellsByKey.get(cellKey(row, column)) ?? [];
  return findLockedLetter(related, params.progress, params.feedback);
}

export function synchronizeCrossingGuesses(entries: PublicEntry[], progress: ProgressLike) {
  const cellLetters = buildCellLetters(entries, progress);
  return Object.fromEntries(
    entries.map((entry) => {
      const letters = Array.from({ length: entry.length }, (_, index) => {
        const { row, column } = getEntryCell(entry, index);
        return cellLetters[cellKey(row, column)] ?? "";
      });
      return [entry.id, serializeLetterSlots(letters)];
    })
  );
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

function findLockedLetter(related: EntryCellRef[], progress: ProgressLike, feedback?: BoardFeedback) {
  const revealed = related
    .map(({ entry, index }) => {
      const reveal = progress.solvedEntries[entry.id] ?? progress.givenUpEntries[entry.id];
      return reveal ? toLetterSlots(normalizeAnswer(reveal.revealedAnswer), entry.length, false)[index] : "";
    })
    .find(Boolean);
  if (revealed) return revealed;

  return related
    .map(({ entry, index }) => (feedback?.[entry.id]?.[index] === "correct" ? getEntryLetters(entry, progress)[index] : ""))
    .find(Boolean);
}

export function toLetterSlots(value: string, length: number, preserveSlots: boolean) {
  const slots = Array<string>(length).fill("");
  if (!preserveSlots) {
    [...normalizeAnswer(value)].slice(0, length).forEach((letter, index) => {
      slots[index] = letter;
    });
    return slots;
  }
  const chars = [...value];
  const hasSlotMarkers = chars.some((char) => char === " ");
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

export function serializeLetterSlots(letters: string[]) {
  return letters.map((letter) => letter || " ").join("").replace(/\s+$/g, "");
}
