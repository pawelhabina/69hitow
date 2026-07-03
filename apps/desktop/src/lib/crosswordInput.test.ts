import { describe, expect, it } from "vitest";
import { clampAudioTime, parseStoredVolume, type PublicEntry, type RevealedEntry } from "@music-crossword/shared";
import {
  type BoardFeedback,
  buildCellLetters,
  buildEntryCellMap,
  clearCrossingCell,
  getLockedCellLetter,
  synchronizeCrossingGuesses,
  toLetterSlots,
  writeCrossingCell
} from "./crosswordInput";

const across: PublicEntry = {
  id: "across",
  type: "TEXT_CLUE",
  promptText: null,
  clueText: "",
  audioUrl: null,
  audioStartTime: null,
  audioEndTime: null,
  direction: "ACROSS",
  startRow: 1,
  startColumn: 0,
  orderNumber: 1,
  length: 3
};

const down: PublicEntry = {
  ...across,
  id: "down",
  direction: "DOWN",
  startRow: 0,
  startColumn: 1,
  orderNumber: 2
};

const emptyProgress = { solvedEntries: {}, givenUpEntries: {}, guesses: {} };

describe("crossword input", () => {
  it("uses a safe default volume and restores valid stored values", () => {
    expect(parseStoredVolume(null)).toBe(0.8);
    expect(parseStoredVolume("")).toBe(0.8);
    expect(parseStoredVolume("0.37")).toBe(0.37);
    expect(parseStoredVolume("2")).toBe(0.8);
  });

  it("keeps playback inside the configured audio segment", () => {
    expect(clampAudioTime(12, 45.25, 62.75, 180)).toBe(45.25);
    expect(clampAudioTime(50, 45.25, 62.75, 180)).toBe(50);
    expect(clampAudioTime(80, 45.25, 62.75, 180)).toBe(62.75);
  });

  it("removes spaces from a revealed answer before filling cells", () => {
    expect(toLetterSlots("NIE PŁACZ EWKA", 12, false).join("")).toBe("NIEPŁACZEWKA");
  });

  it("writes one crossing letter to both entries", () => {
    const map = buildEntryCellMap([across, down]);
    const result = writeCrossingCell({ entry: across, index: 1, letter: "o", progress: emptyProgress, entryCellsByKey: map });
    expect(result.blocked).toBe(false);
    expect(result.guesses).toEqual({ across: " O", down: " O" });
  });

  it("locks a green cell but consumes its matching letter", () => {
    const progress = { ...emptyProgress, guesses: { across: "KOT", down: " O" } };
    const map = buildEntryCellMap([across, down]);
    const feedback: BoardFeedback = { across: ["correct", "correct", "incorrect"] };
    const matching = writeCrossingCell({ entry: down, index: 1, letter: "o", progress, entryCellsByKey: map, feedback });
    const different = writeCrossingCell({ entry: down, index: 1, letter: "z", progress, entryCellsByKey: map, feedback });
    expect(matching).toMatchObject({ blocked: false, unchanged: true, lockedLetter: "O" });
    expect(different).toMatchObject({ blocked: true, lockedLetter: "O" });
    expect(clearCrossingCell({ entry: down, index: 1, progress, entryCellsByKey: map, feedback }).blocked).toBe(true);
    expect(getLockedCellLetter({ entry: down, index: 1, progress, entryCellsByKey: map, feedback })).toBe("O");
  });

  it("normalizes legacy divergent crossing guesses before checking", () => {
    const progress = { ...emptyProgress, guesses: { across: "KOT", down: "AZA" } };
    expect(synchronizeCrossingGuesses([across, down], progress)).toEqual({ across: "KOT", down: "AOA" });
  });

  it("renders a solved answer without blank cells caused by spaces", () => {
    const reveal: RevealedEntry = { revealedAnswer: "K O T", songTitle: null, artist: null, spotifyUrl: null, youtubeUrl: null };
    const progress = { ...emptyProgress, solvedEntries: { across: reveal } };
    expect(buildCellLetters([across], progress)).toEqual({ "1:0": "K", "1:1": "O", "1:2": "T" });
  });
});
