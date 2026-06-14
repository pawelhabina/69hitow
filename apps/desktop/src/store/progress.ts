import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RevealedEntry } from "@music-crossword/shared";

export interface CrosswordProgress {
  solvedEntries: Record<string, RevealedEntry>;
  givenUpEntries: Record<string, RevealedEntry>;
  guesses: Record<string, string>;
  completed: boolean;
}

interface ProgressState {
  playerId: string;
  seenCrosswords: Record<string, boolean>;
  progress: Record<string, CrosswordProgress>;
  markSeen: (id: string) => void;
  setGuess: (crosswordId: string, entryId: string, guess: string) => void;
  setGuesses: (crosswordId: string, guesses: Record<string, string>) => void;
  markSolved: (crosswordId: string, entryId: string, reveal: RevealedEntry) => void;
  markGivenUp: (crosswordId: string, entryId: string, reveal: RevealedEntry) => void;
  markCompleted: (crosswordId: string) => void;
  resetCrossword: (crosswordId: string) => void;
}

function emptyProgress(): CrosswordProgress {
  return { solvedEntries: {}, givenUpEntries: {}, guesses: {}, completed: false };
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set) => ({
      playerId: crypto.randomUUID(),
      seenCrosswords: {},
      progress: {},
      markSeen: (id) => set((state) => ({ seenCrosswords: { ...state.seenCrosswords, [id]: true } })),
      setGuess: (crosswordId, entryId, guess) =>
        set((state) => {
          const current = state.progress[crosswordId] ?? emptyProgress();
          return {
            progress: {
              ...state.progress,
              [crosswordId]: { ...current, guesses: { ...current.guesses, [entryId]: guess } }
            }
          };
        }),
      setGuesses: (crosswordId, guesses) =>
        set((state) => {
          const current = state.progress[crosswordId] ?? emptyProgress();
          return {
            progress: {
              ...state.progress,
              [crosswordId]: { ...current, guesses: { ...current.guesses, ...guesses } }
            }
          };
        }),
      markSolved: (crosswordId, entryId, reveal) =>
        set((state) => {
          const current = state.progress[crosswordId] ?? emptyProgress();
          const { [entryId]: _removed, ...givenUpEntries } = current.givenUpEntries;
          return {
            progress: {
              ...state.progress,
              [crosswordId]: {
                ...current,
                givenUpEntries,
                solvedEntries: { ...current.solvedEntries, [entryId]: reveal }
              }
            }
          };
        }),
      markGivenUp: (crosswordId, entryId, reveal) =>
        set((state) => {
          const current = state.progress[crosswordId] ?? emptyProgress();
          return {
            progress: {
              ...state.progress,
              [crosswordId]: { ...current, givenUpEntries: { ...current.givenUpEntries, [entryId]: reveal } }
            }
          };
        }),
      markCompleted: (crosswordId) =>
        set((state) => {
          const current = state.progress[crosswordId] ?? emptyProgress();
          return { progress: { ...state.progress, [crosswordId]: { ...current, completed: true } } };
        }),
      resetCrossword: (crosswordId) =>
        set((state) => {
          const { [crosswordId]: _removed, ...progress } = state.progress;
          return { progress };
        })
    }),
    { name: "69hitow-progress" }
  )
);
