import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  FileAudio,
  LayoutDashboard,
  ListMusic,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UploadCloud
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
  const [form, setForm] = useState<EntryFormState>(blankEntry);
  const [audio, setAudio] = useState<File | null>(null);
  const [showAnswers, setShowAnswers] = useState(true);

  const query = useQuery({
    queryKey: ["admin-crossword", crosswordId],
    queryFn: () => apiRequest<AdminCrossword>(`/api/admin/crosswords/${crosswordId}`)
  });

  const crossword = query.data;

  const placementErrors = useMemo(() => {
    if (!crossword) return [];
    const errors = validateEntryPlacement(
      form,
      crossword.entries.map((entry) => ({
        id: entry.id,
        normalizedAnswer: entry.normalizedAnswer,
        direction: entry.direction,
        startRow: entry.startRow,
        startColumn: entry.startColumn
      })),
      crossword.gridRows,
      crossword.gridColumns,
      editingEntry?.id
    );
    if ((form.type === "TEXT_CLUE" || form.type === "COMPLETE_LYRIC") && !form.clueText.trim()) {
      errors.push("Ten typ wymaga tekstu podpowiedzi.");
    }
    if ((form.type === "GUESS_TITLE_FROM_AUDIO" || form.type === "GUESS_ARTIST_FROM_AUDIO") && !audio && !editingEntry?.audioPath) {
      errors.push("Ten typ wymaga pliku MP3.");
    }
    const audioStartTime = parseTimeInput(form.audioStartTime);
    const audioEndTime = parseTimeInput(form.audioEndTime);
    if (Number.isNaN(audioStartTime) || Number.isNaN(audioEndTime)) {
      errors.push("Czas fragmentu audio wpisz jako sekundy albo mm:ss, np. 0:45.");
    }
    if (
      audioStartTime !== null &&
      audioEndTime !== null &&
      !Number.isNaN(audioStartTime) &&
      !Number.isNaN(audioEndTime) &&
      audioEndTime <= audioStartTime
    ) {
      errors.push("Koniec fragmentu audio musi byc pozniej niz start.");
    }
    return errors;
  }, [audio, crossword, editingEntry, form]);

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
    mutationFn: async () => {
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (key === "audioStartTime" || key === "audioEndTime") return;
        data.set(key, String(value ?? ""));
      });
      const audioStartTime = parseTimeInput(form.audioStartTime);
      const audioEndTime = parseTimeInput(form.audioEndTime);
      data.set("audioStartTime", audioStartTime === null || Number.isNaN(audioStartTime) ? "" : String(audioStartTime));
      data.set("audioEndTime", audioEndTime === null || Number.isNaN(audioEndTime) ? "" : String(audioEndTime));
      if (audio) data.set("audio", audio);
      const path = editingEntry
        ? `/api/admin/crosswords/${crosswordId}/entries/${editingEntry.id}`
        : `/api/admin/crosswords/${crosswordId}/entries`;
      return apiRequest(path, { method: editingEntry ? "PUT" : "POST", body: data });
    },
    onSuccess: async () => {
      setEditingEntry(null);
      setForm(blankEntry);
      setAudio(null);
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
        setForm((current) => ({ ...current, startRow: variables.startRow, startColumn: variables.startColumn }));
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
      setForm(blankEntry);
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
    setAudio(null);
    setForm({
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
            draft={form.answer ? form : null}
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
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">{editingEntry ? "Edycja hasla" : "Nowe haslo"}</h3>
            {editingEntry ? (
              <Button
                type="button"
                className="h-8 bg-white/[0.06] text-xs text-slate-200"
                onClick={() => { setEditingEntry(null); setForm(blankEntry); setAudio(null); }}
              >
                Anuluj
              </Button>
            ) : null}
          </div>

          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (placementErrors.length) {
                toast.error(placementErrors[0]);
                return;
              }
              entryMutation.mutate();
            }}
          >
            <Field label="Typ hasla">
              <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as EntryType })}>
                {ENTRY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {entryTypeLabel(type)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Odpowiedz" hint={`Normalizacja: ${normalizeAnswer(form.answer) || "-"}`}>
              <Input value={form.answer} onChange={(event) => setForm({ ...form, answer: event.target.value })} />
            </Field>
            <Field label="Podpowiedz tekstowa">
              <Textarea value={form.clueText} onChange={(event) => setForm({ ...form, clueText: event.target.value })} />
            </Field>
            <Field label="Plik MP3">
              <Input type="file" accept="audio/mpeg" onChange={(event) => setAudio(event.target.files?.[0] ?? null)} />
            </Field>
            {editingEntry?.audioUrl ? (
              <audio controls src={withToken(editingEntry.audioUrl)} className="w-full">
                <track kind="captions" />
              </audio>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start fragmentu" hint="Np. 0:45">
                <Input
                  value={form.audioStartTime}
                  placeholder="0:45"
                  onChange={(event) => setForm({ ...form, audioStartTime: event.target.value })}
                />
              </Field>
              <Field label="Koniec fragmentu" hint="Np. 1:02">
                <Input
                  value={form.audioEndTime}
                  placeholder="1:02"
                  onChange={(event) => setForm({ ...form, audioEndTime: event.target.value })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Tytul utworu">
                <Input value={form.songTitle} onChange={(event) => setForm({ ...form, songTitle: event.target.value })} />
              </Field>
              <Field label="Wykonawca">
                <Input value={form.artist} onChange={(event) => setForm({ ...form, artist: event.target.value })} />
              </Field>
              <Field label="Spotify URL">
                <Input value={form.spotifyUrl} onChange={(event) => setForm({ ...form, spotifyUrl: event.target.value })} />
              </Field>
              <Field label="YouTube URL">
                <Input value={form.youtubeUrl} onChange={(event) => setForm({ ...form, youtubeUrl: event.target.value })} />
              </Field>
              <Field label="Kierunek">
                <Select value={form.direction} onChange={(event) => setForm({ ...form, direction: event.target.value as Direction })}>
                  {DIRECTIONS.map((direction) => (
                    <option key={direction} value={direction}>
                      {direction === "ACROSS" ? "Poziomo" : "Pionowo"}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Numer">
                <Input type="number" min={1} value={form.orderNumber} onChange={(event) => setForm({ ...form, orderNumber: Number(event.target.value) })} />
              </Field>
              <Field label="Wiersz startowy">
                <Input type="number" min={0} value={form.startRow} onChange={(event) => setForm({ ...form, startRow: Number(event.target.value) })} />
              </Field>
              <Field label="Kolumna startowa">
                <Input type="number" min={0} value={form.startColumn} onChange={(event) => setForm({ ...form, startColumn: Number(event.target.value) })} />
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
              {placementErrors.length ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
                  {placementErrors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="flex gap-2">
              <Button type="submit" disabled={entryMutation.isPending || Boolean(placementErrors.length)} className="flex-1">
                <Save className="h-4 w-4" /> Zapisz haslo
              </Button>
              {editingEntry ? (
                <DangerButton
                  type="button"
                  onClick={() => window.confirm("Usunac haslo?") && deleteEntryMutation.mutate(editingEntry.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </DangerButton>
              ) : null}
            </div>
          </form>

          <div className="mt-2 grid gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-slate-400">
              <ListMusic className="h-4 w-4" /> Hasla
            </h3>
            {crossword.entries.map((entry) => (
              <button
                key={entry.id}
                onClick={() => startEditing(entry)}
                className={cn(
                  "rounded-md border border-white/10 bg-white/[0.04] p-3 text-left text-sm transition hover:border-cyan/50",
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
              </button>
            ))}
          </div>
        </Card>
      </div>
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
  return `${minutes}:${seconds}`;
}
