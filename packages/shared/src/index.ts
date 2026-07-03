import { z } from "zod";

export const ENTRY_TYPES = [
  "GUESS_TITLE_FROM_AUDIO",
  "GUESS_ARTIST_FROM_AUDIO",
  "COMPLETE_LYRIC",
  "TEXT_CLUE"
] as const;

export const DIRECTIONS = ["ACROSS", "DOWN"] as const;
export const CROSSWORD_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export const DEFAULT_ENTRY_PROMPT = "Zgadnij tytuł";

export type EntryType = (typeof ENTRY_TYPES)[number];
export type Direction = (typeof DIRECTIONS)[number];
export type CrosswordStatus = (typeof CROSSWORD_STATUSES)[number];

export const EntryTypeSchema = z.enum(ENTRY_TYPES);
export const DirectionSchema = z.enum(DIRECTIONS);
export const CrosswordStatusSchema = z.enum(CROSSWORD_STATUSES);

export function normalizeAnswer(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("pl-PL")
    .replace(/[^\p{L}\p{N}ĄĆĘŁŃÓŚŹŻ]/gu, "")
    .replace(/\s/g, "");
}

export function clampAudioTime(time: number, startTime: number, endTime: number | null | undefined, duration: number) {
  const upperBound = Math.min(endTime ?? duration, duration);
  return Math.min(upperBound, Math.max(startTime, time));
}

export function parseStoredVolume(value: string | null, fallback = 0.8) {
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

export const crosswordCreateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  gridRows: z.coerce.number().int().min(5).max(40).default(15),
  gridColumns: z.coerce.number().int().min(5).max(40).default(15)
});

export const crosswordUpdateSchema = crosswordCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required"
);

const optionalAudioTimeSchema = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? null : value),
  z.coerce.number().min(0).max(24 * 60 * 60).nullable().optional()
);

export const entryInputSchema = z
  .object({
    type: EntryTypeSchema,
    answer: z.string().trim().min(1).max(120),
    promptText: z.string().trim().max(191).optional().nullable(),
    clueText: z.string().trim().max(1000).optional().nullable(),
    audioStartTime: optionalAudioTimeSchema,
    audioEndTime: optionalAudioTimeSchema,
    songTitle: z.string().trim().max(200).optional().nullable(),
    artist: z.string().trim().max(200).optional().nullable(),
    spotifyUrl: z.string().trim().url().optional().or(z.literal("")).nullable(),
    youtubeUrl: z.string().trim().url().optional().or(z.literal("")).nullable(),
    direction: DirectionSchema,
    startRow: z.coerce.number().int().min(0),
    startColumn: z.coerce.number().int().min(0),
    orderNumber: z.coerce.number().int().min(1).optional()
  })
  .superRefine((value, context) => {
    if (
      value.audioStartTime !== null &&
      value.audioStartTime !== undefined &&
      value.audioEndTime !== null &&
      value.audioEndTime !== undefined &&
      value.audioEndTime <= value.audioStartTime
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["audioEndTime"],
        message: "Koniec fragmentu musi byc pozniej niz start."
      });
    }
  });

export const loginSchema = z.object({
  password: z.string().min(1).max(500)
});

export const checkAnswerSchema = z.object({
  guess: z.string().min(1).max(500)
});

export const checkBoardSchema = z.object({
  guesses: z.record(z.string(), z.string().max(500))
});

export const gameResultSchema = z.object({
  playerId: z.string().trim().min(8).max(120),
  solvedEntryIds: z.array(z.string().uuid()).default([]),
  givenUpEntryIds: z.array(z.string().uuid()).default([]),
  surrendered: z.boolean().default(false)
});

export type EntryInput = z.infer<typeof entryInputSchema>;
export type LetterCheckStatus = "correct" | "incorrect" | "missing";

export interface PublicCrosswordListItem {
  id: string;
  title: string;
  description: string | null;
  publishedAt: string | null;
  entryCount: number;
}

export interface PublicEntry {
  id: string;
  type: EntryType;
  promptText: string | null;
  clueText: string | null;
  audioUrl: string | null;
  audioStartTime: number | null;
  audioEndTime: number | null;
  direction: Direction;
  startRow: number;
  startColumn: number;
  orderNumber: number;
  length: number;
}

export interface PublicCrossword {
  id: string;
  title: string;
  description: string | null;
  gridRows: number;
  gridColumns: number;
  publishedAt: string | null;
  entries: PublicEntry[];
}

export interface RevealedEntry {
  correct?: boolean;
  revealedAnswer: string;
  songTitle: string | null;
  artist: string | null;
  spotifyUrl: string | null;
  youtubeUrl: string | null;
}

export interface BoardCheckEntryResult {
  id: string;
  correct: boolean;
  letters: LetterCheckStatus[];
  reveal: RevealedEntry | null;
}

export interface BoardCheckResult {
  allCorrect: boolean;
  entries: BoardCheckEntryResult[];
}

export interface AppVersionInfo {
  version: string;
  downloadUrl: string | null;
  notes: string | null;
}

export interface CrosswordGiveUpResult {
  entries: Array<{ id: string; reveal: RevealedEntry }>;
  resultId: string | null;
}

export interface GameResultSummary {
  id: string;
  playerId: string;
  crosswordId: string;
  solvedCount: number;
  givenUpCount: number;
  totalEntries: number;
  completed: boolean;
  surrendered: boolean;
  createdAt: string;
}

export function entryTypeLabel(type: EntryType): string {
  switch (type) {
    case "GUESS_TITLE_FROM_AUDIO":
      return "Odgadnij tytul";
    case "GUESS_ARTIST_FROM_AUDIO":
      return "Odgadnij wykonawce";
    case "COMPLETE_LYRIC":
      return "Dokoncz tekst";
    case "TEXT_CLUE":
      return "Podpowiedz tekstowa";
  }
}

export function validateEntryPlacement(
  candidate: Pick<EntryInput, "answer" | "direction" | "startRow" | "startColumn">,
  existing: Array<{
    id?: string;
    normalizedAnswer: string;
    direction: Direction;
    startRow: number;
    startColumn: number;
  }>,
  gridRows: number,
  gridColumns: number,
  ignoreEntryId?: string
): string[] {
  const normalized = normalizeAnswer(candidate.answer);
  const errors: string[] = [];
  const addError = (message: string) => {
    if (!errors.includes(message)) errors.push(message);
  };
  if (!normalized) {
    errors.push("Znormalizowana odpowiedz jest pusta.");
    return errors;
  }

  const keyOf = (row: number, column: number) => `${row}:${column}`;
  const oppositeDirection: Direction = candidate.direction === "ACROSS" ? "DOWN" : "ACROSS";
  const endRow = candidate.startRow + (candidate.direction === "DOWN" ? normalized.length - 1 : 0);
  const endColumn = candidate.startColumn + (candidate.direction === "ACROSS" ? normalized.length - 1 : 0);
  if (candidate.startRow < 0 || candidate.startColumn < 0 || endRow >= gridRows || endColumn >= gridColumns) {
    errors.push("Haslo wychodzi poza plansze.");
  }

  const occupied = new Map<string, { letter: string; directions: Set<Direction> }>();
  existing
    .filter((entry) => entry.id !== ignoreEntryId)
    .forEach((entry) => {
      [...entry.normalizedAnswer].forEach((letter, index) => {
        const row = entry.startRow + (entry.direction === "DOWN" ? index : 0);
        const column = entry.startColumn + (entry.direction === "ACROSS" ? index : 0);
        const key = keyOf(row, column);
        const cell = occupied.get(key);
        if (cell) {
          cell.directions.add(entry.direction);
        } else {
          occupied.set(key, { letter, directions: new Set([entry.direction]) });
        }
      });
    });

  [...normalized].forEach((letter, index) => {
    const row = candidate.startRow + (candidate.direction === "DOWN" ? index : 0);
    const column = candidate.startColumn + (candidate.direction === "ACROSS" ? index : 0);
    const existingCell = occupied.get(keyOf(row, column));

    if (existingCell && existingCell.letter !== letter) {
      addError(`Kolizja na polu ${row + 1}, ${column + 1}: ${existingCell.letter} != ${letter}.`);
      return;
    }

    if (existingCell?.directions.has(candidate.direction)) {
      addError(`Haslo naklada sie na inne haslo w tym samym kierunku na polu ${row + 1}, ${column + 1}.`);
    }

    const hasValidCrossing = existingCell?.directions.has(oppositeDirection) ?? false;
    const sideNeighbors =
      candidate.direction === "ACROSS"
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
        if (occupied.has(keyOf(neighborRow, neighborColumn))) {
          addError(`Litera na polu ${row + 1}, ${column + 1} styka sie bokiem z innym haslem bez przecięcia.`);
        }
      });
    }
  });

  const beforeRow = candidate.startRow - (candidate.direction === "DOWN" ? 1 : 0);
  const beforeColumn = candidate.startColumn - (candidate.direction === "ACROSS" ? 1 : 0);
  const afterRow = endRow + (candidate.direction === "DOWN" ? 1 : 0);
  const afterColumn = endColumn + (candidate.direction === "ACROSS" ? 1 : 0);

  [
    [beforeRow, beforeColumn],
    [afterRow, afterColumn]
  ].forEach(([row, column]) => {
    if (occupied.has(keyOf(row, column))) {
      addError("Haslo styka sie poczatkiem lub koncem z innym haslem bez przerwy.");
    }
  });

  return errors;
}

export function validateCrosswordLayout(
  entries: Array<{
    id?: string;
    answer?: string;
    normalizedAnswer: string;
    direction: Direction;
    startRow: number;
    startColumn: number;
  }>,
  gridRows: number,
  gridColumns: number
): string[] {
  const errors: string[] = [];
  const addError = (message: string) => {
    if (!errors.includes(message)) errors.push(message);
  };

  entries.forEach((entry) => {
    validateEntryPlacement(
      {
        answer: entry.answer ?? entry.normalizedAnswer,
        direction: entry.direction,
        startRow: entry.startRow,
        startColumn: entry.startColumn
      },
      entries,
      gridRows,
      gridColumns,
      entry.id
    ).forEach((error) => addError(error));
  });

  return errors;
}
