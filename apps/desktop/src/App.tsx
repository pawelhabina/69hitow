import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Headphones,
  Loader2,
  Music2,
  Pause,
  Play,
  RefreshCw,
  Trophy,
  XCircle
} from "lucide-react";
import { toast } from "sonner";
import {
  type PublicCrossword,
  type PublicCrosswordListItem,
  type PublicEntry,
  type RevealedEntry,
  type BoardCheckResult,
  type LetterCheckStatus,
  entryTypeLabel,
  normalizeAnswer
} from "@music-crossword/shared";
import { AudioPlayer } from "@/components/AudioPlayer";
import { Button, Glass } from "@/components/Button";
import { GameBoard } from "@/components/GameBoard";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useProgressStore } from "@/store/progress";

const EMPTY_GAME_PROGRESS = { solvedEntries: {}, givenUpEntries: {}, guesses: {}, completed: false };

export function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        window.beatGrid?.openAdminPanel();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return selectedId ? <Game crosswordId={selectedId} onBack={() => setSelectedId(null)} /> : <Home onSelect={setSelectedId} />;
}

function Home({ onSelect }: { onSelect: (id: string) => void }) {
  const queryClient = useQueryClient();
  const seenCrosswords = useProgressStore((state) => state.seenCrosswords);
  const markSeen = useProgressStore((state) => state.markSeen);
  const progress = useProgressStore((state) => state.progress);
  const previousIds = useRef<Set<string>>(new Set());

  const query = useQuery({
    queryKey: ["public-crosswords"],
    queryFn: () => apiRequest<PublicCrosswordListItem[]>("/api/crosswords"),
    refetchInterval: 60_000
  });

  useEffect(() => {
    if (!query.data) return;
    const ids = new Set(query.data.map((item) => item.id));
    const newItems = query.data.filter((item) => !previousIds.current.has(item.id) && previousIds.current.size > 0);
    if (newItems.length) {
      toast.info(`Nowa plansza: ${newItems[0].title}`);
    }
    previousIds.current = ids;
  }, [query.data]);

  return (
    <main className="h-screen overflow-auto p-6">
      <div className="mx-auto grid max-w-6xl gap-6">
        <header className="flex items-center justify-between pt-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl border border-cyan/30 bg-cyan/15 shadow-glow">
                <Music2 className="h-6 w-6 text-cyan" />
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-normal">69hitow</h1>
                <p className="text-slate-400">Muzyczne krzyzowki</p>
              </div>
            </div>
          </motion.div>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["public-crosswords"] })} disabled={query.isFetching}>
            {query.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Odswiez liste
          </Button>
        </header>

        {query.error ? (
          <Glass className="border-red-400/30 bg-red-500/10">
            <div className="flex items-center gap-3 text-red-100">
              <XCircle className="h-5 w-5" />
              <span>Nie mozna polaczyc sie z API. Sprawdz, czy backend dziala.</span>
            </div>
          </Glass>
        ) : null}

        {query.isLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="glass h-44 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : null}

        {!query.isLoading && query.data?.length === 0 ? (
          <Glass className="grid min-h-72 place-items-center text-center">
            <div>
              <Headphones className="mx-auto h-12 w-12 text-cyan" />
              <h2 className="mt-4 text-2xl font-bold">Brak opublikowanych plansz</h2>
              <p className="mt-2 text-sm text-slate-400">Lista odswieza sie automatycznie co 60 sekund.</p>
            </div>
          </Glass>
        ) : null}

        <section className="grid grid-cols-3 gap-4">
          {query.data?.map((crossword) => {
            const completed = progress[crossword.id]?.completed;
            const isNew = !seenCrosswords[crossword.id];
            return (
              <motion.button
                layout
                key={crossword.id}
                onClick={() => {
                  markSeen(crossword.id);
                  onSelect(crossword.id);
                }}
                className="glass min-h-48 rounded-lg p-5 text-left transition hover:border-cyan/50 hover:bg-cyan/[0.06]"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-xl font-bold">{crossword.title}</h2>
                  <div className="flex gap-2">
                    {isNew ? <Badge className="bg-violet/20 text-violet-100">Nowa</Badge> : null}
                    {completed ? <Badge className="bg-emerald-500/20 text-emerald-100">Ukonczona</Badge> : null}
                  </div>
                </div>
                <p className="mt-3 line-clamp-3 text-sm text-slate-400">{crossword.description || "Plansza muzycznych skojarzen."}</p>
                <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
                  <span>{crossword.entryCount} hasel</span>
                  <span>{crossword.publishedAt ? new Date(crossword.publishedAt).toLocaleDateString("pl-PL") : ""}</span>
                </div>
              </motion.button>
            );
          })}
        </section>
      </div>
    </main>
  );
}

function Game({ crosswordId, onBack }: { crosswordId: string; onBack: () => void }) {
  const query = useQuery({
    queryKey: ["public-crossword", crosswordId],
    queryFn: () => apiRequest<PublicCrossword>(`/api/crosswords/${crosswordId}`)
  });
  const storedProgress = useProgressStore((state) => state.progress[crosswordId]);
  const progress = storedProgress ?? EMPTY_GAME_PROGRESS;
  const setGuess = useProgressStore((state) => state.setGuess);
  const markSolved = useProgressStore((state) => state.markSolved);
  const markCompleted = useProgressStore((state) => state.markCompleted);
  const resetCrossword = useProgressStore((state) => state.resetCrossword);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeCellIndex, setActiveCellIndex] = useState(0);
  const [completionDismissed, setCompletionDismissed] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, LetterCheckStatus[]>>({});
  const [justCompleted, setJustCompleted] = useState(false);

  useEffect(() => {
    if (query.data && !activeId) {
      setActiveId(query.data.entries[0]?.id ?? null);
      setActiveCellIndex(0);
    }
  }, [activeId, query.data]);

  const crossword = query.data;
  const activeEntry = useMemo(
    () => crossword?.entries.find((entry) => entry.id === activeId) ?? crossword?.entries[0],
    [activeId, crossword?.entries]
  );

  const checkBoardMutation = useMutation({
    mutationFn: () =>
      apiRequest<BoardCheckResult>(`/api/crosswords/${crosswordId}/check-board`, {
        method: "POST",
        body: JSON.stringify({ guesses: progress.guesses })
      }),
    onSuccess: (result) => {
      setFeedback(Object.fromEntries(result.entries.map((entry) => [entry.id, entry.letters])));
      result.entries.forEach((entry) => {
        if (entry.correct && entry.reveal) {
          markSolved(crosswordId, entry.id, entry.reveal);
        }
      });
      if (result.allCorrect) {
        markCompleted(crosswordId);
        setJustCompleted(true);
        setCompletionDismissed(false);
        toast.success("Cala krzyzowka jest poprawna.");
      } else {
        setJustCompleted(false);
        toast.error("Czerwone kratki wymagaja poprawy.");
      }
    },
    onError: (error) => toast.error(error.message)
  });

  const completedCount = Object.keys(progress.solvedEntries).length + Object.keys(progress.givenUpEntries).length;
  const isCompleted = Boolean(crossword?.entries.length && completedCount >= crossword.entries.length);
  const completedView = isCompleted || justCompleted;
  const showCompletionOverlay = completedView && !completionDismissed;
  const currentReveal = activeEntry ? progress.solvedEntries[activeEntry.id] ?? progress.givenUpEntries[activeEntry.id] : null;

  const selectEntry = (entry: PublicEntry, cellIndex = 0) => {
    setActiveId(entry.id);
    setActiveCellIndex(Math.max(0, Math.min(cellIndex, entry.length - 1)));
  };

  useEffect(() => {
    if (isCompleted && !progress.completed) markCompleted(crosswordId);
  }, [crosswordId, isCompleted, markCompleted, progress.completed]);

  useEffect(() => {
    if (!isCompleted && !justCompleted) setCompletionDismissed(false);
  }, [isCompleted, justCompleted]);

  useEffect(() => {
    const handleTyping = (event: KeyboardEvent) => {
      if (!activeEntry || currentReveal || showCompletionOverlay) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;

      if (event.key === "Enter") {
        event.preventDefault();
        if (!checkBoardMutation.isPending) checkBoardMutation.mutate();
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        const current = normalizeAnswer(progress.guesses[activeEntry.id] ?? "");
        const removeIndex = Math.max(0, Math.min(activeCellIndex - 1, current.length - 1));
        const next = current.slice(0, removeIndex) + current.slice(removeIndex + 1);
        setFeedback((currentFeedback) => {
          const { [activeEntry.id]: _removed, ...rest } = currentFeedback;
          return rest;
        });
        setGuess(crosswordId, activeEntry.id, next);
        setActiveCellIndex(removeIndex);
        return;
      }

      if (event.key.length !== 1) return;
      const letter = normalizeAnswer(event.key);
      if (!letter) return;
      event.preventDefault();
      const current = normalizeAnswer(progress.guesses[activeEntry.id] ?? "");
      const letters = [...current.padEnd(activeCellIndex, "")];
      letters[activeCellIndex] = letter[0];
      const next = letters.join("").slice(0, activeEntry.length);
      setFeedback((currentFeedback) => {
        const { [activeEntry.id]: _removed, ...rest } = currentFeedback;
        return rest;
      });
      setGuess(crosswordId, activeEntry.id, next);
      setActiveCellIndex((index) => Math.min(index + 1, activeEntry.length - 1));
    };

    window.addEventListener("keydown", handleTyping);
    return () => window.removeEventListener("keydown", handleTyping);
  }, [
    activeEntry,
    activeCellIndex,
    checkBoardMutation,
    crosswordId,
    currentReveal,
    progress.guesses,
    setGuess,
    showCompletionOverlay
  ]);

  if (query.isLoading || !crossword || !activeEntry) {
    return (
      <main className="grid h-screen place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan" />
      </main>
    );
  }

  const solvedCount = Object.keys(progress.solvedEntries).length;
  const givenUpCount = Object.keys(progress.givenUpEntries).length;
  const displayedSolvedCount = completedView ? crossword.entries.length : solvedCount;
  const resetCurrentCrossword = () => {
    resetCrossword(crosswordId);
    setFeedback({});
    setJustCompleted(false);
    setCompletionDismissed(false);
    setActiveId(crossword.entries[0]?.id ?? null);
    setActiveCellIndex(0);
    toast.info("Krzyzowka zresetowana lokalnie.");
  };

  return (
    <main className="h-screen overflow-hidden p-5">
      <div className="mx-auto grid h-full max-w-[1500px] grid-rows-[auto_1fr] gap-4">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button onClick={onBack} className="bg-white/[0.06] text-slate-100">
              <ArrowLeft className="h-4 w-4" /> Lista
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{crossword.title}</h1>
              <p className="text-sm text-slate-400">
                {displayedSolvedCount} poprawnych · {givenUpCount} poddanych · {crossword.entries.length} razem
              </p>
            </div>
          </div>
          <div className="ml-auto h-2 w-72 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-gradient-to-r from-cyan to-violet" style={{ width: `${completedView ? 100 : (completedCount / crossword.entries.length) * 100}%` }} />
          </div>
          <Button
            onClick={resetCurrentCrossword}
            className="border-red-400/25 bg-red-500/10 text-red-100 hover:bg-red-500/20"
          >
            Resetuj
          </Button>
          <Button disabled={checkBoardMutation.isPending || completedView} onClick={() => checkBoardMutation.mutate()}>
            <CheckCircle2 className="h-4 w-4" /> Sprawdz krzyzowke
          </Button>
        </header>

        <div className="grid min-h-0 grid-cols-[minmax(560px,1fr)_420px] gap-4">
          <Glass className="grid place-items-center overflow-auto">
            <div className="w-full max-w-[820px]">
              <GameBoard
                crossword={crossword}
                activeEntryId={activeEntry.id}
                progress={progress}
                feedback={feedback}
                activeCellIndex={activeCellIndex}
                onSelect={(entry, cellIndex) => selectEntry(entry, cellIndex)}
              />
            </div>
          </Glass>

          <Glass className="grid min-h-0 grid-rows-[auto_1fr] gap-4 overflow-hidden">
            {completedView ? (
              <div className="grid gap-2">
                <Badge>Ukonczona</Badge>
                <h2 className="text-2xl font-bold">Rozwiazane hasla</h2>
              </div>
            ) : (
              <div className="grid gap-4">
                <div>
                  <Badge>{activeEntry.direction === "ACROSS" ? "Poziomo" : "Pionowo"} {activeEntry.orderNumber}</Badge>
                  <h2 className="mt-3 text-2xl font-bold">{entryTypeLabel(activeEntry.type)}</h2>
                </div>

                {activeEntry.clueText ? <p className="rounded-lg border border-white/10 bg-white/[0.05] p-4 text-slate-200">{activeEntry.clueText}</p> : null}
                {activeEntry.audioUrl ? (
                  <AudioPlayer url={activeEntry.audioUrl} startTime={activeEntry.audioStartTime} endTime={activeEntry.audioEndTime} />
                ) : null}

                {currentReveal ? <Reveal reveal={currentReveal} givenUp={Boolean(progress.givenUpEntries[activeEntry.id])} /> : null}
              </div>
            )}

            <div className="min-h-0 overflow-auto pr-1">
              <EntryList title="Poziomo" entries={crossword.entries.filter((entry) => entry.direction === "ACROSS")} activeId={activeEntry.id} progress={progress} onSelect={(entry) => selectEntry(entry)} />
              <EntryList title="Pionowo" entries={crossword.entries.filter((entry) => entry.direction === "DOWN")} activeId={activeEntry.id} progress={progress} onSelect={(entry) => selectEntry(entry)} />
            </div>
          </Glass>
        </div>
      </div>

      <AnimatePresence>
        {showCompletionOverlay ? (
          <motion.div className="fixed inset-0 grid place-items-center bg-black/70 p-6 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div initial={{ scale: 0.94, y: 20 }} animate={{ scale: 1, y: 0 }} className="glass w-full max-w-md rounded-xl p-8 text-center">
              <Trophy className="mx-auto h-14 w-14 text-cyan" />
              <h2 className="mt-4 text-3xl font-black">Plansza ukonczona</h2>
              <p className="mt-2 text-slate-400">
                Poprawne: {completedView ? crossword.entries.length : solvedCount}. Poddane: {givenUpCount}.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-3">
                <Button onClick={() => setCompletionDismissed(true)} className="w-full">
                  Pokaz krzyzowke
                </Button>
                <Button onClick={resetCurrentCrossword} className="w-full border-red-400/25 bg-red-500/10 text-red-100 hover:bg-red-500/20">
                  Resetuj
                </Button>
                <Button onClick={onBack} className="w-full border-slate-400/20 bg-white/[0.06] text-slate-200">
                  Wroc do listy
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}

function EntryList({
  title,
  entries,
  activeId,
  progress,
  onSelect
}: {
  title: string;
  entries: PublicEntry[];
  activeId: string;
  progress: { solvedEntries: Record<string, RevealedEntry>; givenUpEntries: Record<string, RevealedEntry> };
  onSelect: (entry: PublicEntry) => void;
}) {
  return (
    <div className="mb-4">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{title}</h3>
      <div className="grid gap-2">
        {entries.map((entry) => {
          const solved = Boolean(progress.solvedEntries[entry.id]);
          const givenUp = Boolean(progress.givenUpEntries[entry.id]);
          const reveal = progress.solvedEntries[entry.id] ?? progress.givenUpEntries[entry.id];
          return (
            <div
              key={entry.id}
              className={cn(
                "rounded-md border border-white/10 bg-white/[0.04] p-3 text-left text-sm transition hover:border-cyan/50",
                activeId === entry.id && "border-cyan/60 bg-cyan/10",
                solved && "border-emerald-300/40 bg-emerald-500/10",
                givenUp && !solved && "border-slate-300/30 bg-slate-500/10"
              )}
            >
              <button type="button" onClick={() => onSelect(entry)} className="flex w-full items-center justify-between gap-3 text-left">
                <span className="font-semibold">{entry.orderNumber}. {entryTypeLabel(entry.type)}</span>
                <span className="shrink-0 text-xs text-slate-500">{entry.length} liter</span>
              </button>
              {entry.audioUrl && reveal ? <MiniAudioControl url={entry.audioUrl} startTime={entry.audioStartTime} endTime={entry.audioEndTime} /> : null}
              {reveal ? (
                <div className="mt-2 text-xs text-slate-400">
                  <span className="font-semibold text-slate-200">{reveal.revealedAnswer}</span>
                  {reveal.songTitle ? <span> · {reveal.songTitle}</span> : null}
                  {reveal.artist ? <span> · {reveal.artist}</span> : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniAudioControl({ url, startTime, endTime }: { url: string; startTime?: number | null; endTime?: number | null }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const segmentStart = startTime ?? 0;
  const segmentEnd = endTime ?? duration;

  useEffect(() => {
    const audio = new Audio(url);
    audio.preload = "metadata";
    audioRef.current = audio;

    const updateTime = () => {
      if (endTime !== null && endTime !== undefined && audio.currentTime >= endTime) {
        audio.pause();
        audio.currentTime = segmentStart;
        setPlaying(false);
      }
      setCurrentTime(audio.currentTime);
    };
    const updateDuration = () => {
      const fullDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
      setDuration(endTime ?? fullDuration);
      if (segmentStart > 0) {
        audio.currentTime = segmentStart;
        setCurrentTime(segmentStart);
      }
    };
    const finish = () => {
      setPlaying(false);
      setCurrentTime(audio.duration || 0);
    };

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);
    audio.addEventListener("ended", finish);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
      audio.removeEventListener("ended", finish);
    };
  }, [endTime, segmentStart, url]);

  const segmentDuration = Math.max(0, segmentEnd - segmentStart);
  const percent = segmentDuration > 0 ? Math.min(100, ((currentTime - segmentStart) / segmentDuration) * 100) : 0;

  return (
    <div className="mt-3 grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-md border border-white/10 bg-black/20 p-2">
      <button
        type="button"
        aria-label={playing ? "Pauza" : "Odtworz"}
        onClick={async (event) => {
          event.stopPropagation();
          const audio = audioRef.current;
          if (!audio) return;
          if (playing) {
            audio.pause();
            setPlaying(false);
            return;
          }
          try {
            if (audio.currentTime < segmentStart || (endTime !== null && endTime !== undefined && audio.currentTime >= endTime)) {
              audio.currentTime = segmentStart;
            }
            await audio.play();
            setPlaying(true);
          } catch {
            toast.error("Nie mozna odtworzyc tego pliku audio.");
          }
        }}
        className="grid h-8 w-8 place-items-center rounded-full border border-cyan/30 bg-cyan/15 text-cyan transition hover:bg-cyan/25"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan to-violet transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      <span className="font-mono text-[11px] text-slate-400">
        {formatTime(currentTime)} / {formatTime(segmentEnd)}
      </span>
    </div>
  );
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = String(whole % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

function Reveal({ reveal, givenUp }: { reveal: RevealedEntry; givenUp: boolean }) {
  return (
    <div className={cn("rounded-lg border p-4 text-sm", givenUp ? "border-slate-300/30 bg-slate-500/10" : "border-emerald-300/40 bg-emerald-500/10")}>
      <p className="font-bold">{givenUp ? "Odpowiedz ujawniona" : "Poprawnie"}: {reveal.revealedAnswer}</p>
      {reveal.songTitle ? <p className="mt-2 text-slate-300">Tytul: {reveal.songTitle}</p> : null}
      {reveal.artist ? <p className="text-slate-300">Wykonawca: {reveal.artist}</p> : null}
      <div className="mt-3 flex gap-2">
        {reveal.spotifyUrl ? <ExternalButton url={reveal.spotifyUrl} label="Spotify" /> : null}
        {reveal.youtubeUrl ? <ExternalButton url={reveal.youtubeUrl} label="YouTube" /> : null}
      </div>
    </div>
  );
}

function ExternalButton({ url, label }: { url: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
      className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-slate-100"
    >
      <ExternalLink className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex rounded-full bg-cyan/15 px-2.5 py-1 text-xs font-bold text-cyan", className)}>{children}</span>;
}
