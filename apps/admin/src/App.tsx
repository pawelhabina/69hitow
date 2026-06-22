import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  FileAudio,
  LayoutDashboard,
  ListMusic,
  LogOut,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UploadCloud,
  X
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  DIRECTIONS,
  ENTRY_TYPES,
  type Direction,
  type EntryInput,
  type EntryType,
  entryTypeLabel,
  normalizeAnswer,
  validateCrosswordLayout,
  validateEntryPlacement
} from "@music-crossword/shared";
import { AdminGrid } from "@/components/AdminGrid";
import { Button, Card, DangerButton, Field, Input, Select, Textarea } from "@/components/ui";
import { apiRequest, getToken, setToken } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AdminCrossword, AdminEntry, AdminListCrossword } from "@/types";

type Tab = "DRAFT" | "PUBLISHED";

const blankEntry: EntryFormState = {
  type: "TEXT_CLUE",
  answer: "",
  clueText: "",
  audioStartTime: "",
  audioEndTime: "",
  songTitle: "",
  artist: "",
  spotifyUrl: "",
  youtubeUrl: "",
  direction: "ACROSS",
  startRow: 0,
  startColumn: 0,
  orderNumber: 1
};

interface EntryFormState {
  type: EntryType;
  answer: string;
  clueText: string;
  audioStartTime: string;
  audioEndTime: string;
  songTitle: string;
  artist: string;
  spotifyUrl: string;
  youtubeUrl: string;
  direction: Direction;
  startRow: number;
  startColumn: number;
  orderNumber: number;
}

interface EntryValidation {
  placementErrors: string[];
  blockingErrors: string[];
  saveBlockingErrors: string[];
  allErrors: string[];
}

export function App() {
  const [token, updateToken] = useState(getToken());

  if (!token) {
    return <Login onLoggedIn={(newToken) => updateToken(newToken)} />;
  }

  return <Studio onLogout={() => { setToken(null); updateToken(null); }} />;
}

function Login({ onLoggedIn }: { onLoggedIn: (token: string) => void }) {
  const { register, handleSubmit, formState } = useForm<{ password: string }>();
  const mutation = useMutation({
    mutationFn: (payload: { password: string }) =>
      apiRequest<{ token: string }>("/api/admin/login", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: ({ token }) => {
      setToken(token);
      onLoggedIn(token);
      toast.success("Zalogowano do 69hitow Studio.");
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="glass grid w-full max-w-md gap-5 rounded-xl p-8"
      >
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan">69hitow Studio</p>
          <h1 className="mt-3 text-3xl font-bold">Panel kreatora</h1>
          <p className="mt-2 text-sm text-slate-400">Dostep tylko dla administratora.</p>
        </div>
        <Field label="Haslo administratora">
          <Input type="password" autoFocus {...register("password", { required: true })} />
        </Field>
        <Button type="submit" disabled={formState.isSubmitting || mutation.isPending}>
          Zaloguj
        </Button>
      </motion.form>
    </main>
  );
}

function Studio({ onLogout }: { onLogout: () => void }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("DRAFT");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["admin-crosswords"],
    queryFn: () => apiRequest<AdminListCrossword[]>("/api/admin/crosswords")
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest<AdminCrossword>("/api/admin/crosswords", {
        method: "POST",
        body: JSON.stringify({ title: "Nowa krzyzowka", description: "", gridRows: 15, gridColumns: 15 })
      }),
    onSuccess: async (crossword) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-crosswords"] });
      setSelectedId(crossword.id);
    },
    onError: (error) => toast.error(error.message)
  });

  const crosswords = listQuery.data ?? [];
  const drafts = crosswords.filter((item) => item.status === "DRAFT").length;
  const published = crosswords.filter((item) => item.status === "PUBLISHED").length;
  const visible = crosswords.filter((item) => item.status === tab);

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto grid max-w-[1500px] gap-5">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan">69hitow Studio</p>
            <h1 className="text-3xl font-bold">Kreator muzycznych krzyzowek</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => listQuery.refetch()} className="bg-white/[0.06] text-slate-100">
              <RefreshCw className="h-4 w-4" /> Odswiez
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              <Plus className="h-4 w-4" /> Nowa krzyzowka
            </Button>
            <Button onClick={onLogout} className="border-white/10 bg-white/[0.06] text-slate-200">
              <LogOut className="h-4 w-4" /> Wyloguj
            </Button>
          </div>
        </header>

        <section className="grid grid-cols-[360px_1fr] gap-5">
          <aside className="grid content-start gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <p className="text-sm text-slate-400">Szkice</p>
                <p className="mt-1 text-3xl font-bold">{drafts}</p>
              </Card>
              <Card>
                <p className="text-sm text-slate-400">Publiczne</p>
                <p className="mt-1 text-3xl font-bold">{published}</p>
              </Card>
            </div>

            <Card className="grid gap-4">
              <div className="grid grid-cols-2 rounded-md bg-white/[0.06] p-1">
                {(["DRAFT", "PUBLISHED"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setTab(status)}
                    className={cn(
                      "rounded px-3 py-2 text-sm font-semibold text-slate-400 transition",
                      tab === status && "bg-cyan/20 text-cyan"
                    )}
                  >
                    {status === "DRAFT" ? "Szkice" : "Publiczne"}
                  </button>
                ))}
              </div>

              <div className="grid max-h-[calc(100vh-310px)] gap-3 overflow-auto pr-1">
                {visible.map((crossword) => (
                  <CrosswordCard
                    key={crossword.id}
                    crossword={crossword}
                    active={selectedId === crossword.id}
                    onSelect={() => setSelectedId(crossword.id)}
                  />
                ))}
                {!visible.length ? (
                  <div className="rounded-lg border border-dashed border-white/15 p-6 text-sm text-slate-400">
                    Brak plansz w tej zakladce.
                  </div>
                ) : null}
              </div>
            </Card>
          </aside>

          <section>
            {selectedId ? (
              <Editor crosswordId={selectedId} onDeleted={() => { setSelectedId(null); queryClient.invalidateQueries({ queryKey: ["admin-crosswords"] }); }} />
            ) : (
              <Card className="flex min-h-[640px] items-center justify-center text-center">
                <div>
                  <LayoutDashboard className="mx-auto h-12 w-12 text-cyan" />
                  <h2 className="mt-4 text-2xl font-bold">Wybierz plansze</h2>
                  <p className="mt-2 max-w-md text-sm text-slate-400">
                    Utworz szkic albo wybierz istniejaca krzyzowke, aby edytowac uklad, audio i publikacje.
                  </p>
                </div>
              </Card>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

function CrosswordCard({ crossword, active, onSelect }: { crossword: AdminListCrossword; active: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "rounded-lg border p-4 text-left transition",
        active ? "border-cyan/60 bg-cyan/10" : "border-white/10 bg-white/[0.04] hover:border-white/25"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-white">{crossword.title}</h3>
        <span className={cn("rounded-full px-2 py-1 text-[11px] font-bold", crossword.status === "PUBLISHED" ? "bg-emerald-400/15 text-emerald-200" : "bg-violet/15 text-violet-200")}>
          {crossword.status === "PUBLISHED" ? "Publiczna" : "Szkic"}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-slate-400">{crossword.description || "Bez opisu"}</p>
      <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
        <span>{crossword.entryCount} hasel</span>
        <span>{new Date(crossword.createdAt).toLocaleDateString("pl-PL")}</span>
      </div>
    </button>
  );
}

function Editor({ crosswordId, onDeleted }: { crosswordId: string; onDeleted: () => void }) {
  const queryClient = useQueryClient();
  const [editingEntry, setEditingEntry] = useState<AdminEntry | null>(null);
  const [newForm, setNewForm] = useState<EntryFormState>(blankEntry);
  const [newAudio, setNewAudio] = useState<File | null>(null);
  const [editForm, setEditForm] = useState<EntryFormState>(blankEntry);
  const [editAudio, setEditAudio] = useState<File | null>(null);
  const [showAnswers, setShowAnswers] = useState(true);

  const query = useQuery({
    queryKey: ["admin-crossword", crosswordId],
    queryFn: () => apiRequest<AdminCrossword>(`/api/admin/crosswords/${crosswordId}`)
  });

  const crossword = query.data;

  const getEntryValidation = (entryForm: EntryFormState, entryAudio: File | null, entry?: AdminEntry | null): EntryValidation => {
    if (!crossword) return { placementErrors: [], blockingErrors: [], saveBlockingErrors: [], allErrors: [] };
    const placementErrors = validateEntryPlacement(
      entryForm,
      crossword.entries.map((entry) => ({
        id: entry.id,
        normalizedAnswer: entry.normalizedAnswer,
        direction: entry.direction,
        startRow: entry.startRow,
        startColumn: entry.startColumn
      })),
      crossword.gridRows,
      crossword.gridColumns,
      entry?.id
    );
    const blockingErrors: string[] = [];
    if (!normalizeAnswer(entryForm.answer)) {
      blockingErrors.push("Znormalizowana odpowiedz jest pusta.");
    }
    if ((entryForm.type === "TEXT_CLUE" || entryForm.type === "COMPLETE_LYRIC") && !entryForm.clueText.trim()) {
      blockingErrors.push("Ten typ wymaga tekstu podpowiedzi.");
    }
    if ((entryForm.type === "GUESS_TITLE_FROM_AUDIO" || entryForm.type === "GUESS_ARTIST_FROM_AUDIO") && !entryAudio && !entry?.audioPath) {
      blockingErrors.push("Ten typ wymaga pliku MP3.");
    }
    const audioStartTime = parseTimeInput(entryForm.audioStartTime);
    const audioEndTime = parseTimeInput(entryForm.audioEndTime);
    if (Number.isNaN(audioStartTime) || Number.isNaN(audioEndTime)) {
      blockingErrors.push("Czas fragmentu audio wpisz jako sekundy albo mm:ss.SSS, np. 0:45.250.");
    }
    if (
      audioStartTime !== null &&
      audioEndTime !== null &&
      !Number.isNaN(audioStartTime) &&
      !Number.isNaN(audioEndTime) &&
      audioEndTime <= audioStartTime
    ) {
      blockingErrors.push("Koniec fragmentu audio musi byc pozniej niz start.");
    }
    const saveBlockingErrors = crossword.status === "DRAFT" ? blockingErrors : [...blockingErrors, ...placementErrors];
    return { placementErrors, blockingErrors, saveBlockingErrors, allErrors: [...blockingErrors, ...placementErrors] };
  };

  const newValidation = useMemo(() => getEntryValidation(newForm, newAudio), [crossword, newAudio, newForm]);
  const editValidation = useMemo(
    () => (editingEntry ? getEntryValidation(editForm, editAudio, editingEntry) : { placementErrors: [], blockingErrors: [], saveBlockingErrors: [], allErrors: [] }),
    [crossword, editAudio, editForm, editingEntry]
  );

  const layoutErrors = useMemo(() => {
    if (!crossword) return [];
    return validateCrosswordLayout(crossword.entries, crossword.gridRows, crossword.gridColumns);
  }, [crossword]);

  const saveMetaMutation = useMutation({
    mutationFn: (payload: { title: string; description: string; gridRows: number; gridColumns: number }) =>
      apiRequest(`/api/admin/crosswords/${crosswordId}`, { method: "PUT", body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-crossword", crosswordId] });
      queryClient.invalidateQueries({ queryKey: ["admin-crosswords"] });
      toast.success("Zapisano ustawienia planszy.");
    },
    onError: (error) => toast.error(error.message)
  });

  const entryMutation = useMutation({
    mutationFn: async ({ entry, entryForm, entryAudio }: { entry?: AdminEntry | null; entryForm: EntryFormState; entryAudio: File | null }) => {
      const data = new FormData();
      Object.entries(entryForm).forEach(([key, value]) => {
        if (key === "audioStartTime" || key === "audioEndTime") return;
        data.set(key, String(value ?? ""));
      });
      const audioStartTime = parseTimeInput(entryForm.audioStartTime);
      const audioEndTime = parseTimeInput(entryForm.audioEndTime);
      data.set("audioStartTime", audioStartTime === null || Number.isNaN(audioStartTime) ? "" : String(audioStartTime));
      data.set("audioEndTime", audioEndTime === null || Number.isNaN(audioEndTime) ? "" : String(audioEndTime));
      if (crossword?.status === "DRAFT") data.set("allowInvalidPlacement", "true");
      if (entryAudio) data.set("audio", entryAudio);
      const path = entry
        ? `/api/admin/crosswords/${crosswordId}/entries/${entry.id}`
        : `/api/admin/crosswords/${crosswordId}/entries`;
      return apiRequest(path, { method: entry ? "PUT" : "POST", body: data });
    },
    onSuccess: async (_data, variables) => {
      if (variables.entry) {
        setEditingEntry(null);
        setEditForm(blankEntry);
        setEditAudio(null);
      } else {
        setNewForm(blankEntry);
        setNewAudio(null);
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-crossword", crosswordId] });
      await queryClient.invalidateQueries({ queryKey: ["admin-crosswords"] });
      toast.success("Haslo zapisane.");
    },
    onError: (error) => toast.error(error.message)
  });

  const moveEntryMutation = useMutation({
    mutationFn: async ({ entry, startRow, startColumn }: { entry: AdminEntry; startRow: number; startColumn: number; errors: string[] }) => {
      if (!crossword) throw new Error("Nie zaladowano krzyzowki.");
      const data = new FormData();
      data.set("type", entry.type);
      data.set("answer", entry.answer);
      data.set("clueText", entry.clueText ?? "");
      data.set("audioStartTime", entry.audioStartTime === null ? "" : String(entry.audioStartTime));
      data.set("audioEndTime", entry.audioEndTime === null ? "" : String(entry.audioEndTime));
      data.set("songTitle", entry.songTitle ?? "");
      data.set("artist", entry.artist ?? "");
      data.set("spotifyUrl", entry.spotifyUrl ?? "");
      data.set("youtubeUrl", entry.youtubeUrl ?? "");
      data.set("direction", entry.direction);
      data.set("startRow", String(startRow));
      data.set("startColumn", String(startColumn));
      data.set("orderNumber", String(entry.orderNumber));
      data.set("allowInvalidPlacement", "true");

      return apiRequest(`/api/admin/crosswords/${crosswordId}/entries/${entry.id}`, { method: "PUT", body: data });
    },
    onSuccess: async (_data, variables) => {
      if (editingEntry?.id === variables.entry.id) {
        setEditForm((current) => ({ ...current, startRow: variables.startRow, startColumn: variables.startColumn }));
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-crossword", crosswordId] });
      await queryClient.invalidateQueries({ queryKey: ["admin-crosswords"] });
      if (variables.errors.length) {
        toast.error("Haslo przesuniete, ale układ ma błąd. Popraw czerwone pola przed publikacja.");
      } else {
        toast.success("Przesunieto haslo.");
      }
    },
    onError: (error) => toast.error(error.message)
  });

  const actionMutation = useMutation({
    mutationFn: (action: "publish" | "unpublish" | "delete") => {
      if (action === "delete") return apiRequest(`/api/admin/crosswords/${crosswordId}`, { method: "DELETE" });
      return apiRequest(`/api/admin/crosswords/${crosswordId}/${action}`, { method: "POST" });
    },
    onSuccess: async (_data, action) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-crosswords"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-crossword", crosswordId] });
      if (action === "delete") onDeleted();
      toast.success(action === "publish" ? "Plansza opublikowana." : action === "unpublish" ? "Plansza cofnieta do szkicu." : "Plansza usunieta.");
    },
    onError: (error) => toast.error(error.message)
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (entryId: string) => apiRequest(`/api/admin/crosswords/${crosswordId}/entries/${entryId}`, { method: "DELETE" }),
    onSuccess: async () => {
      setEditingEntry(null);
      setEditForm(blankEntry);
      setEditAudio(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-crossword", crosswordId] });
      await queryClient.invalidateQueries({ queryKey: ["admin-crosswords"] });
      toast.success("Haslo usuniete.");
    },
    onError: (error) => toast.error(error.message)
  });

  if (!crossword) {
    return <Card className="min-h-[640px] animate-pulse" />;
  }

  const startEditing = (entry: AdminEntry) => {
    setEditingEntry(entry);
    setEditAudio(null);
    setEditForm({
      type: entry.type,
      answer: entry.answer,
      clueText: entry.clueText ?? "",
      audioStartTime: formatTimeInput(entry.audioStartTime),
      audioEndTime: formatTimeInput(entry.audioEndTime),
      songTitle: entry.songTitle ?? "",
      artist: entry.artist ?? "",
      spotifyUrl: entry.spotifyUrl ?? "",
      youtubeUrl: entry.youtubeUrl ?? "",
      direction: entry.direction,
      startRow: entry.startRow,
      startColumn: entry.startColumn,
      orderNumber: entry.orderNumber
    });
  };

  return (
    <div className="grid gap-5">
      <Card className="grid gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{crossword.title}</h2>
            <p className="text-sm text-slate-400">
              {crossword.status === "PUBLISHED" ? "Publiczna" : "Szkic"} · {crossword.entries.length} hasel
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowAnswers((value) => !value)} className="bg-white/[0.06] text-slate-100">
              {showAnswers ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showAnswers ? "Ukryj odpowiedzi" : "Pokaz odpowiedzi"}
            </Button>
            <Button
              onClick={() => {
                if (crossword.status !== "PUBLISHED" && layoutErrors.length) {
                  toast.error(layoutErrors[0]);
                  return;
                }
                actionMutation.mutate(crossword.status === "PUBLISHED" ? "unpublish" : "publish");
              }}
              disabled={actionMutation.isPending || (crossword.status !== "PUBLISHED" && layoutErrors.length > 0)}
            >
              <UploadCloud className="h-4 w-4" />
              {crossword.status === "PUBLISHED" ? "Ukryj" : "Opublikuj"}
            </Button>
            <DangerButton
              onClick={() => window.confirm("Usunac krzyzowke razem z plikami audio?") && actionMutation.mutate("delete")}
            >
              <Trash2 className="h-4 w-4" /> Usun
            </DangerButton>
          </div>
        </div>

        <form
          className="grid grid-cols-[1.4fr_2fr_90px_110px_auto] gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            saveMetaMutation.mutate({
              title: String(formData.get("title")),
              description: String(formData.get("description")),
              gridRows: Number(formData.get("gridRows")),
              gridColumns: Number(formData.get("gridColumns"))
            });
          }}
        >
          <Input name="title" defaultValue={crossword.title} />
          <Input name="description" defaultValue={crossword.description ?? ""} placeholder="Opis" />
          <Input name="gridRows" type="number" min={5} max={40} defaultValue={crossword.gridRows} />
          <Input name="gridColumns" type="number" min={5} max={40} defaultValue={crossword.gridColumns} />
          <Button type="submit" disabled={saveMetaMutation.isPending}>
            <Save className="h-4 w-4" /> Zapisz
          </Button>
        </form>
      </Card>

      <div className="grid grid-cols-[minmax(520px,1fr)_430px] gap-5">
        <Card>
          <AdminGrid
            rows={crossword.gridRows}
            columns={crossword.gridColumns}
            entries={crossword.entries}
            activeEntryId={editingEntry?.id}
            draft={newForm.answer ? newForm : null}
            showAnswers={showAnswers}
            onEntryClick={startEditing}
            onEntryMove={(entry, startRow, startColumn) => {
              const errors = validateEntryPlacement(
                { answer: entry.answer, direction: entry.direction, startRow, startColumn },
                crossword.entries.map((currentEntry) => ({
                  id: currentEntry.id,
                  normalizedAnswer: currentEntry.normalizedAnswer,
                  direction: currentEntry.direction,
                  startRow: currentEntry.startRow,
                  startColumn: currentEntry.startColumn
                })),
                crossword.gridRows,
                crossword.gridColumns,
                entry.id
              );
              moveEntryMutation.mutate({ entry, startRow, startColumn, errors });
            }}
          />
        </Card>

        <Card className="grid max-h-[calc(100vh-260px)] content-start gap-4 overflow-auto">
          <h3 className="text-lg font-bold">Nowe haslo</h3>

          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (newValidation.saveBlockingErrors.length) {
                toast.error(newValidation.saveBlockingErrors[0]);
                return;
              }
              entryMutation.mutate({ entryForm: newForm, entryAudio: newAudio });
            }}
          >
            <Field label="Typ hasla">
              <Select value={newForm.type} onChange={(event) => setNewForm({ ...newForm, type: event.target.value as EntryType })}>
                {ENTRY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {entryTypeLabel(type)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Odpowiedz" hint={`Normalizacja: ${normalizeAnswer(newForm.answer) || "-"}`}>
              <Input value={newForm.answer} onChange={(event) => setNewForm({ ...newForm, answer: event.target.value })} />
            </Field>
            <Field label="Podpowiedz tekstowa">
              <Textarea value={newForm.clueText} onChange={(event) => setNewForm({ ...newForm, clueText: event.target.value })} />
            </Field>
            <Field label="Plik MP3">
              <Input type="file" accept="audio/mpeg" onChange={(event) => setNewAudio(event.target.files?.[0] ?? null)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start fragmentu" hint="Np. 0:45.250">
                <Input
                  value={newForm.audioStartTime}
                  placeholder="0:45.250"
                  onChange={(event) => setNewForm({ ...newForm, audioStartTime: event.target.value })}
                />
              </Field>
              <Field label="Koniec fragmentu" hint="Np. 1:02.750">
                <Input
                  value={newForm.audioEndTime}
                  placeholder="1:02.750"
                  onChange={(event) => setNewForm({ ...newForm, audioEndTime: event.target.value })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Tytul utworu">
                <Input value={newForm.songTitle} onChange={(event) => setNewForm({ ...newForm, songTitle: event.target.value })} />
              </Field>
              <Field label="Wykonawca">
                <Input value={newForm.artist} onChange={(event) => setNewForm({ ...newForm, artist: event.target.value })} />
              </Field>
              <Field label="Spotify URL">
                <Input value={newForm.spotifyUrl} onChange={(event) => setNewForm({ ...newForm, spotifyUrl: event.target.value })} />
              </Field>
              <Field label="YouTube URL">
                <Input value={newForm.youtubeUrl} onChange={(event) => setNewForm({ ...newForm, youtubeUrl: event.target.value })} />
              </Field>
              <Field label="Kierunek">
                <Select value={newForm.direction} onChange={(event) => setNewForm({ ...newForm, direction: event.target.value as Direction })}>
                  {DIRECTIONS.map((direction) => (
                    <option key={direction} value={direction}>
                      {direction === "ACROSS" ? "Poziomo" : "Pionowo"}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Numer">
                <Input type="number" min={1} value={newForm.orderNumber} onChange={(event) => setNewForm({ ...newForm, orderNumber: Number(event.target.value) })} />
              </Field>
              <Field label="Wiersz startowy">
                <Input type="number" min={0} value={newForm.startRow} onChange={(event) => setNewForm({ ...newForm, startRow: Number(event.target.value) })} />
              </Field>
              <Field label="Kolumna startowa">
                <Input type="number" min={0} value={newForm.startColumn} onChange={(event) => setNewForm({ ...newForm, startColumn: Number(event.target.value) })} />
              </Field>
            </div>

            <AnimatePresence>
              {layoutErrors.length ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
                  <p className="font-semibold">Plansza ma bledy ukladu. Nie mozna jej opublikowac.</p>
                  {layoutErrors.slice(0, 4).map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                  {layoutErrors.length > 4 ? <p>...i jeszcze {layoutErrors.length - 4}.</p> : null}
                </motion.div>
              ) : null}
              {newValidation.allErrors.length ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
                  {newValidation.placementErrors.length && !newValidation.blockingErrors.length ? (
                    <p className="font-semibold">Mozesz zapisac szkic z tym bledem, ale publikacja bedzie zablokowana.</p>
                  ) : null}
                  {newValidation.allErrors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="flex gap-2">
              <Button type="submit" disabled={entryMutation.isPending || Boolean(newValidation.saveBlockingErrors.length)} className="flex-1">
                <Save className="h-4 w-4" /> Zapisz haslo
              </Button>
            </div>
          </form>

          <div className="mt-2 grid gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-slate-400">
              <ListMusic className="h-4 w-4" /> Hasla
            </h3>
            {crossword.entries.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  "rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm transition",
                  editingEntry?.id === entry.id && "border-cyan/60 bg-cyan/10"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{entry.orderNumber}. {entry.answer}</span>
                  {entry.audioPath ? (
                    <span className="flex items-center gap-2 text-xs text-cyan">
                      {entry.audioStartTime !== null || entry.audioEndTime !== null
                        ? `${formatTimeInput(entry.audioStartTime ?? 0)}-${formatTimeInput(entry.audioEndTime)}`
                        : null}
                      <FileAudio className="h-4 w-4" />
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {entry.direction === "ACROSS" ? "Poziomo" : "Pionowo"} · {entryTypeLabel(entry.type)}
                </p>
                <Button type="button" className="mt-3 h-8 w-full bg-white/[0.06] text-xs text-slate-200" onClick={() => startEditing(entry)}>
                  <Pencil className="h-3.5 w-3.5" /> Edytuj
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <AnimatePresence>
        {editingEntry ? (
          <EntryEditModal
            entry={editingEntry}
            form={editForm}
            audio={editAudio}
            validation={editValidation}
            isSaving={entryMutation.isPending}
            isDeleting={deleteEntryMutation.isPending}
            onChange={setEditForm}
            onAudioChange={setEditAudio}
            onClose={() => {
              setEditingEntry(null);
              setEditForm(blankEntry);
              setEditAudio(null);
            }}
            onSave={() => {
              if (editValidation.saveBlockingErrors.length) {
                toast.error(editValidation.saveBlockingErrors[0]);
                return;
              }
              entryMutation.mutate({ entry: editingEntry, entryForm: editForm, entryAudio: editAudio });
            }}
            onDelete={() => window.confirm("Usunac haslo?") && deleteEntryMutation.mutate(editingEntry.id)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function EntryEditModal({
  entry,
  form,
  audio,
  validation,
  isSaving,
  isDeleting,
  onChange,
  onAudioChange,
  onClose,
  onSave,
  onDelete
}: {
  entry: AdminEntry;
  form: EntryFormState;
  audio: File | null;
  validation: EntryValidation;
  isSaving: boolean;
  isDeleting: boolean;
  onChange: (form: EntryFormState) => void;
  onAudioChange: (audio: File | null) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.form
        className="glass grid max-h-[92vh] w-full max-w-5xl gap-5 overflow-auto rounded-xl border border-cyan/20 p-6 shadow-glow"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan">Edycja odpowiedzi</p>
            <h3 className="mt-1 text-2xl font-bold">{entry.orderNumber}. {entry.answer}</h3>
            <p className="mt-1 text-sm text-slate-400">
              {entry.direction === "ACROSS" ? "Poziomo" : "Pionowo"} · {entryTypeLabel(entry.type)}
            </p>
          </div>
          <Button type="button" className="h-9 w-9 bg-white/[0.06] px-0 text-slate-200" onClick={onClose} aria-label="Zamknij modal">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-[1.1fr_0.9fr] gap-5">
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Typ hasla">
                <Select value={form.type} onChange={(event) => onChange({ ...form, type: event.target.value as EntryType })}>
                  {ENTRY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {entryTypeLabel(type)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Numer">
                <Input type="number" min={1} value={form.orderNumber} onChange={(event) => onChange({ ...form, orderNumber: Number(event.target.value) })} />
              </Field>
            </div>

            <Field label="Odpowiedz" hint={`Normalizacja: ${normalizeAnswer(form.answer) || "-"}`}>
              <Input value={form.answer} onChange={(event) => onChange({ ...form, answer: event.target.value })} />
            </Field>

            <Field label="Podpowiedz tekstowa">
              <Textarea value={form.clueText} onChange={(event) => onChange({ ...form, clueText: event.target.value })} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Tytul utworu">
                <Input value={form.songTitle} onChange={(event) => onChange({ ...form, songTitle: event.target.value })} />
              </Field>
              <Field label="Wykonawca">
                <Input value={form.artist} onChange={(event) => onChange({ ...form, artist: event.target.value })} />
              </Field>
              <Field label="Spotify URL">
                <Input value={form.spotifyUrl} onChange={(event) => onChange({ ...form, spotifyUrl: event.target.value })} />
              </Field>
              <Field label="YouTube URL">
                <Input value={form.youtubeUrl} onChange={(event) => onChange({ ...form, youtubeUrl: event.target.value })} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Kierunek">
                <Select value={form.direction} onChange={(event) => onChange({ ...form, direction: event.target.value as Direction })}>
                  {DIRECTIONS.map((direction) => (
                    <option key={direction} value={direction}>
                      {direction === "ACROSS" ? "Poziomo" : "Pionowo"}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Dlugosc">
                <Input value={normalizeAnswer(form.answer).length} readOnly className="text-slate-400" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Wiersz">
                <Input type="number" min={0} value={form.startRow} onChange={(event) => onChange({ ...form, startRow: Number(event.target.value) })} />
              </Field>
              <Field label="Kolumna">
                <Input type="number" min={0} value={form.startColumn} onChange={(event) => onChange({ ...form, startColumn: Number(event.target.value) })} />
              </Field>
            </div>
          </div>

          <div className="grid content-start gap-4">
            <Card className="grid gap-3 bg-white/[0.04]">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-slate-400">
                <FileAudio className="h-4 w-4 text-cyan" /> Fragment audio
              </div>
              <Field label="Zastap plik MP3">
                <Input type="file" accept="audio/mpeg" onChange={(event) => onAudioChange(event.target.files?.[0] ?? null)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start" hint="mm:ss.SSS, np. 0:45.250">
                  <Input
                    value={form.audioStartTime}
                    placeholder="0:45.250"
                    inputMode="decimal"
                    onChange={(event) => onChange({ ...form, audioStartTime: event.target.value })}
                  />
                </Field>
                <Field label="Koniec" hint="mm:ss.SSS, np. 1:02.750">
                  <Input
                    value={form.audioEndTime}
                    placeholder="1:02.750"
                    inputMode="decimal"
                    onChange={(event) => onChange({ ...form, audioEndTime: event.target.value })}
                  />
                </Field>
              </div>
              <AudioSegmentPreview
                audioUrl={entry.audioUrl}
                file={audio}
                startValue={form.audioStartTime}
                endValue={form.audioEndTime}
                onStartChange={(value) => onChange({ ...form, audioStartTime: value })}
                onEndChange={(value) => onChange({ ...form, audioEndTime: value })}
              />
            </Card>

            <AnimatePresence>
              {validation.allErrors.length ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
                  {validation.placementErrors.length && !validation.blockingErrors.length ? (
                    <p className="font-semibold">Mozesz zapisac szkic z tym bledem, ale publikacja bedzie zablokowana.</p>
                  ) : null}
                  {validation.allErrors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex justify-between gap-3 border-t border-white/10 pt-4">
          <DangerButton type="button" onClick={onDelete} disabled={isDeleting}>
            <Trash2 className="h-4 w-4" /> Usun haslo
          </DangerButton>
          <div className="flex gap-2">
            <Button type="button" className="bg-white/[0.06] text-slate-200" onClick={onClose}>
              Anuluj
            </Button>
            <Button type="submit" disabled={isSaving || Boolean(validation.saveBlockingErrors.length)}>
              <Save className="h-4 w-4" /> Zapisz zmiany
            </Button>
          </div>
        </div>
      </motion.form>
    </motion.div>
  );
}

function AudioSegmentPreview({
  audioUrl,
  file,
  startValue,
  endValue,
  onStartChange,
  onEndChange
}: {
  audioUrl: string | null;
  file: File | null;
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const source = fileUrl ?? (audioUrl ? withToken(audioUrl) : null);
  const start = parseTimeInput(startValue);
  const end = parseTimeInput(endValue);
  const safeStart = start !== null && !Number.isNaN(start) ? start : 0;
  const safeEnd = end !== null && !Number.isNaN(end) ? end : null;

  useEffect(() => {
    if (!file) {
      setFileUrl(null);
      return undefined;
    }
    const nextUrl = URL.createObjectURL(file);
    setFileUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  useEffect(() => {
    const stopFrame = () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
    if (!isPlaying) {
      stopFrame();
      return undefined;
    }

    const update = () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (safeEnd !== null && audio.currentTime >= safeEnd) {
        audio.pause();
        audio.currentTime = safeEnd;
        setCurrentTime(safeEnd);
        setIsPlaying(false);
        frameRef.current = null;
        return;
      }
      setCurrentTime(audio.currentTime);
      frameRef.current = window.requestAnimationFrame(update);
    };

    frameRef.current = window.requestAnimationFrame(update);
    return stopFrame;
  }, [isPlaying, safeEnd]);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [source]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio || !source) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    const shouldResetToStart = audio.currentTime < safeStart || (safeEnd !== null && audio.currentTime >= safeEnd);
    if (shouldResetToStart) audio.currentTime = safeStart;
    await audio.play();
    setIsPlaying(true);
  };

  const seek = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrentTime(value);
  };

  return (
    <div className="grid gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
      {source ? (
        <audio
          ref={audioRef}
          src={source}
          preload="metadata"
          onLoadedMetadata={(event) => {
            const nextDuration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0;
            setDuration(nextDuration);
            const initialTime = Math.min(safeStart, nextDuration || safeStart);
            event.currentTarget.currentTime = initialTime;
            setCurrentTime(initialTime);
          }}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        >
          <track kind="captions" />
        </audio>
      ) : null}
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3 text-xs font-mono text-slate-300">
          <span>{formatTimeInput(currentTime)}</span>
          <span>{formatTimeInput(duration)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.001}
          value={Math.min(currentTime, duration || currentTime)}
          disabled={!source || !duration}
          onChange={(event) => seek(Number(event.target.value))}
          className="h-2 w-full cursor-pointer accent-cyan disabled:cursor-not-allowed disabled:opacity-40"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-400">
          <p>Podglad odcinka</p>
          <p className="font-mono text-slate-300">
            {formatTimeInput(safeStart)} - {formatTimeInput(safeEnd)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="h-9 bg-white/[0.06] px-3 text-xs text-slate-200" disabled={!source || !duration} onClick={() => onStartChange(formatTimeInput(currentTime))}>
            Ustaw start
          </Button>
          <Button type="button" className="h-9 bg-white/[0.06] px-3 text-xs text-slate-200" disabled={!source || !duration} onClick={() => onEndChange(formatTimeInput(currentTime))}>
            Ustaw koniec
          </Button>
          <Button type="button" className="h-9" disabled={!source} onClick={toggle}>
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isPlaying ? "Pauza" : "Odtworz"}
          </Button>
        </div>
      </div>
      {!source ? <p className="text-xs text-slate-500">Ten wpis nie ma jeszcze pliku audio.</p> : null}
    </div>
  );
}

function withToken(url: string) {
  const token = getToken();
  if (!token) return url;
  const parsed = new URL(url);
  parsed.searchParams.set("token", token);
  return parsed.toString();
}

function parseTimeInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+([.,]\d+)?$/.test(trimmed)) return Number(trimmed.replace(",", "."));

  const parts = trimmed.split(":");
  if (parts.length < 2 || parts.length > 3) return Number.NaN;
  if (!parts.every((part) => /^\d+([.,]\d+)?$/.test(part))) return Number.NaN;

  const numbers = parts.map((part) => Number(part.replace(",", ".")));
  if (numbers.some((part) => !Number.isFinite(part))) return Number.NaN;
  if (numbers.length === 2) {
    const [minutes, seconds] = numbers;
    if (seconds >= 60) return Number.NaN;
    return minutes * 60 + seconds;
  }
  const [hours, minutes, seconds] = numbers;
  if (minutes >= 60 || seconds >= 60) return Number.NaN;
  return hours * 3600 + minutes * 60 + seconds;
}

function formatTimeInput(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  const whole = Math.floor(value);
  const minutes = Math.floor(whole / 60);
  const seconds = String(whole % 60).padStart(2, "0");
  const milliseconds = Math.round((value - whole) * 1000);
  return milliseconds > 0 ? `${minutes}:${seconds}.${String(milliseconds).padStart(3, "0")}` : `${minutes}:${seconds}`;
}
