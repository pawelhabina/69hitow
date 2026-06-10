import type { CrosswordStatus, Direction, EntryType } from "@music-crossword/shared";

export interface AdminListCrossword {
  id: string;
  title: string;
  description: string | null;
  status: CrosswordStatus;
  gridRows: number;
  gridColumns: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  entryCount: number;
}

export interface AdminEntry {
  id: string;
  crosswordId: string;
  type: EntryType;
  answer: string;
  normalizedAnswer: string;
  clueText: string | null;
  audioPath: string | null;
  audioUrl: string | null;
  audioStartTime: number | null;
  audioEndTime: number | null;
  songTitle: string | null;
  artist: string | null;
  spotifyUrl: string | null;
  youtubeUrl: string | null;
  direction: Direction;
  startRow: number;
  startColumn: number;
  orderNumber: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCrossword extends Omit<AdminListCrossword, "entryCount"> {
  entries: AdminEntry[];
}
