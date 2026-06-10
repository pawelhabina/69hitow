import type { CrosswordEntry } from "@prisma/client";
import {
  type EntryInput,
  normalizeAnswer,
  validateEntryPlacement
} from "@music-crossword/shared";

export function validateEntryBusinessRules(
  input: EntryInput,
  hasAudio: boolean,
  entries: CrosswordEntry[],
  gridRows: number,
  gridColumns: number,
  ignoreEntryId?: string,
  options: { validatePlacement?: boolean } = {}
) {
  const errors: string[] = [];
  const validatePlacement = options.validatePlacement ?? true;
  const normalizedAnswer = normalizeAnswer(input.answer);

  if (!normalizedAnswer) errors.push("Znormalizowana odpowiedz jest pusta.");
  if (input.type === "GUESS_TITLE_FROM_AUDIO" || input.type === "GUESS_ARTIST_FROM_AUDIO") {
    if (!hasAudio) errors.push("Ten typ hasla wymaga pliku MP3.");
  }
  if (
    input.audioStartTime !== null &&
    input.audioStartTime !== undefined &&
    input.audioEndTime !== null &&
    input.audioEndTime !== undefined &&
    input.audioEndTime <= input.audioStartTime
  ) {
    errors.push("Koniec fragmentu audio musi byc pozniej niz start.");
  }
  if (input.type === "COMPLETE_LYRIC" || input.type === "TEXT_CLUE") {
    if (!input.clueText?.trim()) errors.push("Ten typ hasla wymaga tekstu podpowiedzi.");
  }

  if (validatePlacement) {
    errors.push(
      ...validateEntryPlacement(
        input,
        entries.map((entry) => ({
          id: entry.id,
          normalizedAnswer: entry.normalizedAnswer,
          direction: entry.direction,
          startRow: entry.startRow,
          startColumn: entry.startColumn
        })),
        gridRows,
        gridColumns,
        ignoreEntryId
      )
    )
  }

  return { errors, normalizedAnswer };
}
