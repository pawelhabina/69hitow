import path from "node:path";
import bcrypt from "bcryptjs";
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { ZodError } from "zod";
import {
  checkAnswerSchema,
  checkBoardSchema,
  crosswordCreateSchema,
  crosswordUpdateSchema,
  entryInputSchema,
  gameResultSchema,
  loginSchema,
  normalizeAnswer,
  validateCrosswordLayout
} from "@music-crossword/shared";
import { requireAdmin, signAdminToken, verifyAdminToken } from "./auth.js";
import { env } from "./env.js";
import { prisma } from "./prisma.js";
import { audioUpload, audioUploadDir, relativeAudioPath, removeLocalFile } from "./uploads.js";
import { validateEntryBusinessRules } from "./validation.js";

export const routes = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false
});

function asyncRoute(handler: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((error) => {
      if (error instanceof ZodError) {
        res.status(400).json({ message: "Niepoprawne dane.", issues: error.flatten() });
        return;
      }
      if (error instanceof Error && error.message.includes("MP3")) {
        res.status(400).json({ message: error.message });
        return;
      }
      console.error(error);
      res.status(500).json({ message: "Blad serwera." });
    });
  };
}

function routeParam(req: Request, key: string) {
  const value = req.params[key];
  const first = Array.isArray(value) ? value[0] : value;
  if (!first) throw new Error(`Missing route param: ${key}`);
  return first;
}

function publicAudioUrl(audioPath: string | null) {
  if (!audioPath) return null;
  return `${env.publicApiUrl}/api/audio/${path.basename(audioPath)}`;
}

function adminAudioUrl(audioPath: string | null) {
  if (!audioPath) return null;
  return `${env.publicApiUrl}/api/admin/audio/${path.basename(audioPath)}`;
}

function reveal(entry: {
  answer: string;
  songTitle: string | null;
  artist: string | null;
  spotifyUrl: string | null;
  youtubeUrl: string | null;
}) {
  return {
    revealedAnswer: entry.answer,
    songTitle: entry.songTitle,
    artist: entry.artist,
    spotifyUrl: entry.spotifyUrl,
    youtubeUrl: entry.youtubeUrl
  };
}

async function createGameResult(input: {
  crosswordId: string;
  playerId: string;
  solvedEntryIds: string[];
  givenUpEntryIds: string[];
  surrendered: boolean;
}) {
  const crossword = await prisma.crossword.findFirst({
    where: { id: input.crosswordId, status: "PUBLISHED" },
    include: { entries: { select: { id: true } } }
  });
  if (!crossword) return null;

  const entryIds = new Set(crossword.entries.map((entry) => entry.id));
  const solved = new Set(input.solvedEntryIds.filter((id) => entryIds.has(id)));
  const givenUp = new Set(input.givenUpEntryIds.filter((id) => entryIds.has(id) && !solved.has(id)));
  const solvedCount = solved.size;
  const givenUpCount = input.surrendered ? crossword.entries.length - solvedCount : givenUp.size;
  const completed = solvedCount + givenUpCount >= crossword.entries.length;

  return prisma.gameResult.create({
    data: {
      playerId: input.playerId,
      crosswordId: crossword.id,
      solvedCount,
      givenUpCount,
      totalEntries: crossword.entries.length,
      completed,
      surrendered: input.surrendered
    }
  });
}

function sendAudioFile(res: Response, filename: string) {
  return res.sendFile(path.join(audioUploadDir, filename), (error) => {
    if (!error || res.headersSent) return;
    if ("code" in error && error.code === "ENOENT") {
      res.status(404).json({ message: "Plik audio nie istnieje na serwerze." });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Blad odczytu pliku audio." });
  });
}

routes.get("/health", (_req, res) => {
  res.json({ ok: true, service: "music-crossword-api" });
});

routes.get("/app-version", (_req, res) => {
  res.json({
    version: env.desktopAppVersion,
    downloadUrl: env.desktopDownloadUrl || null,
    notes: env.desktopReleaseNotes || null
  });
});

routes.get(
  "/audio/:filename",
  asyncRoute(async (req, res) => {
    const filename = routeParam(req, "filename");
    const audioPath = `uploads/audio/${filename}`;
    const entry = await prisma.crosswordEntry.findFirst({
      where: { audioPath, crossword: { status: "PUBLISHED" } },
      select: { id: true }
    });
    if (!entry) return res.status(404).json({ message: "Plik audio nie jest publiczny." });
    return sendAudioFile(res, filename);
  })
);

routes.get(
  "/crosswords",
  asyncRoute(async (_req, res) => {
    const crosswords = await prisma.crossword.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ publishedAt: "desc" }],
      include: { _count: { select: { entries: true } } }
    });
    res.json(
      crosswords.map((crossword) => ({
        id: crossword.id,
        title: crossword.title,
        description: crossword.description,
        publishedAt: crossword.publishedAt?.toISOString() ?? null,
        entryCount: crossword._count.entries
      }))
    );
  })
);

routes.get(
  "/crosswords/:id",
  asyncRoute(async (req, res) => {
    const id = routeParam(req, "id");
    const crossword = await prisma.crossword.findFirst({
      where: { id, status: "PUBLISHED" },
      include: { entries: { orderBy: [{ direction: "asc" }, { orderNumber: "asc" }] } }
    });
    if (!crossword) return res.status(404).json({ message: "Nie znaleziono krzyzowki." });
    res.json({
      id: crossword.id,
      title: crossword.title,
      description: crossword.description,
      gridRows: crossword.gridRows,
      gridColumns: crossword.gridColumns,
      publishedAt: crossword.publishedAt?.toISOString() ?? null,
      entries: crossword.entries.map((entry) => ({
        id: entry.id,
        type: entry.type,
        clueText: entry.clueText,
        audioUrl: publicAudioUrl(entry.audioPath),
        audioStartTime: entry.audioStartTime,
        audioEndTime: entry.audioEndTime,
        direction: entry.direction,
        startRow: entry.startRow,
        startColumn: entry.startColumn,
        orderNumber: entry.orderNumber,
        length: entry.normalizedAnswer.length
      }))
    });
  })
);

routes.post(
  "/crosswords/:id/check-board",
  asyncRoute(async (req, res) => {
    const { guesses } = checkBoardSchema.parse(req.body);
    const id = routeParam(req, "id");
    const crossword = await prisma.crossword.findFirst({
      where: { id, status: "PUBLISHED" },
      include: { entries: { orderBy: [{ direction: "asc" }, { orderNumber: "asc" }] } }
    });
    if (!crossword) return res.status(404).json({ message: "Nie znaleziono krzyzowki." });

    const entries = crossword.entries.map((entry) => {
      const guess = normalizeAnswer(guesses[entry.id] ?? "");
      const answerLetters = [...entry.normalizedAnswer];
      const guessLetters = [...guess];
      const letters = answerLetters.map((letter, index) => {
        if (!guessLetters[index]) return "missing";
        return guessLetters[index] === letter ? "correct" : "incorrect";
      });
      const correct = guess === entry.normalizedAnswer;
      return {
        id: entry.id,
        correct,
        letters,
        reveal: correct ? reveal(entry) : null
      };
    });

    return res.json({
      allCorrect: entries.every((entry) => entry.correct),
      entries
    });
  })
);

routes.post(
  "/crosswords/:id/result",
  asyncRoute(async (req, res) => {
    const id = routeParam(req, "id");
    const input = gameResultSchema.parse(req.body);
    const result = await createGameResult({
      crosswordId: id,
      playerId: input.playerId,
      solvedEntryIds: input.solvedEntryIds,
      givenUpEntryIds: input.givenUpEntryIds,
      surrendered: input.surrendered
    });
    if (!result) return res.status(404).json({ message: "Nie znaleziono krzyzowki." });
    return res.status(201).json({
      id: result.id,
      playerId: result.playerId,
      crosswordId: result.crosswordId,
      solvedCount: result.solvedCount,
      givenUpCount: result.givenUpCount,
      totalEntries: result.totalEntries,
      completed: result.completed,
      surrendered: result.surrendered,
      createdAt: result.createdAt.toISOString()
    });
  })
);

routes.post(
  "/crosswords/:id/give-up",
  asyncRoute(async (req, res) => {
    const id = routeParam(req, "id");
    const input = gameResultSchema.parse({ ...req.body, surrendered: true });
    const crossword = await prisma.crossword.findFirst({
      where: { id, status: "PUBLISHED" },
      include: { entries: { orderBy: [{ direction: "asc" }, { orderNumber: "asc" }] } }
    });
    if (!crossword) return res.status(404).json({ message: "Nie znaleziono krzyzowki." });
    const result = await createGameResult({
      crosswordId: crossword.id,
      playerId: input.playerId,
      solvedEntryIds: input.solvedEntryIds,
      givenUpEntryIds: crossword.entries.map((entry) => entry.id),
      surrendered: true
    });
    return res.json({
      resultId: result?.id ?? null,
      entries: crossword.entries.map((entry) => ({ id: entry.id, reveal: reveal(entry) }))
    });
  })
);

routes.post(
  "/crosswords/:crosswordId/entries/:entryId/check",
  asyncRoute(async (req, res) => {
    const { guess } = checkAnswerSchema.parse(req.body);
    const crosswordId = routeParam(req, "crosswordId");
    const entryId = routeParam(req, "entryId");
    const entry = await prisma.crosswordEntry.findFirst({
      where: {
        id: entryId,
        crosswordId,
        crossword: { status: "PUBLISHED" }
      }
    });
    if (!entry) return res.status(404).json({ message: "Nie znaleziono hasla." });
    if (normalizeAnswer(guess) !== entry.normalizedAnswer) {
      return res.json({ correct: false });
    }
    return res.json({ correct: true, ...reveal(entry) });
  })
);

routes.post(
  "/crosswords/:crosswordId/entries/:entryId/give-up",
  asyncRoute(async (req, res) => {
    const crosswordId = routeParam(req, "crosswordId");
    const entryId = routeParam(req, "entryId");
    const entry = await prisma.crosswordEntry.findFirst({
      where: {
        id: entryId,
        crosswordId,
        crossword: { status: "PUBLISHED" }
      }
    });
    if (!entry) return res.status(404).json({ message: "Nie znaleziono hasla." });
    return res.json(reveal(entry));
  })
);

routes.post(
  "/admin/login",
  loginLimiter,
  asyncRoute(async (req, res) => {
    const { password } = loginSchema.parse(req.body);
    if (!env.adminPasswordHash || !env.jwtSecret) {
      return res.status(500).json({ message: "Panel administratora nie jest skonfigurowany." });
    }
    const ok = await bcrypt.compare(password, env.adminPasswordHash);
    if (!ok) return res.status(401).json({ message: "Niepoprawne haslo." });
    return res.json({ token: signAdminToken() });
  })
);

routes.get(
  "/admin/audio/:filename",
  asyncRoute(async (req, res) => {
    const header = req.headers.authorization;
    const bearer = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
    const queryToken = typeof req.query.token === "string" ? req.query.token : null;
    if (!verifyAdminToken(bearer ?? queryToken)) {
      return res.status(401).json({ message: "Brak autoryzacji." });
    }
    return sendAudioFile(res, routeParam(req, "filename"));
  })
);

routes.get(
  "/admin/crosswords",
  requireAdmin,
  asyncRoute(async (_req, res) => {
    const crosswords = await prisma.crossword.findMany({
      orderBy: [{ updatedAt: "desc" }],
      include: { _count: { select: { entries: true } } }
    });
    res.json(
      crosswords.map((crossword) => ({
        id: crossword.id,
        title: crossword.title,
        description: crossword.description,
        status: crossword.status,
        gridRows: crossword.gridRows,
        gridColumns: crossword.gridColumns,
        createdAt: crossword.createdAt.toISOString(),
        updatedAt: crossword.updatedAt.toISOString(),
        publishedAt: crossword.publishedAt?.toISOString() ?? null,
        entryCount: crossword._count.entries
      }))
    );
  })
);

routes.post(
  "/admin/crosswords",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const input = crosswordCreateSchema.parse(req.body);
    const crossword = await prisma.crossword.create({ data: input });
    return res.status(201).json(crossword);
  })
);

routes.get(
  "/admin/crosswords/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const id = routeParam(req, "id");
    const crossword = await prisma.crossword.findUnique({
      where: { id },
      include: { entries: { orderBy: [{ direction: "asc" }, { orderNumber: "asc" }] } }
    });
    if (!crossword) return res.status(404).json({ message: "Nie znaleziono krzyzowki." });
    return res.json({
      ...crossword,
      createdAt: crossword.createdAt.toISOString(),
      updatedAt: crossword.updatedAt.toISOString(),
      publishedAt: crossword.publishedAt?.toISOString() ?? null,
      entries: crossword.entries.map((entry) => ({
        ...entry,
        audioUrl: adminAudioUrl(entry.audioPath),
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString()
      }))
    });
  })
);

routes.put(
  "/admin/crosswords/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const input = crosswordUpdateSchema.parse(req.body);
    const crossword = await prisma.crossword.update({ where: { id: routeParam(req, "id") }, data: input });
    return res.json(crossword);
  })
);

routes.post(
  "/admin/crosswords/:id/entries",
  requireAdmin,
  audioUpload.single("audio"),
  asyncRoute(async (req, res) => {
    const id = routeParam(req, "id");
    const crossword = await prisma.crossword.findUnique({
      where: { id },
      include: { entries: true }
    });
    if (!crossword) return res.status(404).json({ message: "Nie znaleziono krzyzowki." });
    const input = entryInputSchema.parse(req.body);
    const audioPath = req.file ? relativeAudioPath(req.file) : null;
    const { errors, normalizedAnswer } = validateEntryBusinessRules(
      input,
      Boolean(audioPath),
      crossword.entries,
      crossword.gridRows,
      crossword.gridColumns
    );
    if (errors.length) {
      removeLocalFile(audioPath);
      return res.status(400).json({ message: "Haslo jest niepoprawne.", errors });
    }
    const orderNumber =
      input.orderNumber ??
      (await prisma.crosswordEntry.count({ where: { crosswordId: crossword.id, direction: input.direction } })) + 1;
    const entry = await prisma.crosswordEntry.create({
      data: {
        crosswordId: crossword.id,
        type: input.type,
        answer: input.answer.trim(),
        normalizedAnswer,
        clueText: input.clueText || null,
        audioPath,
        audioStartTime: input.audioStartTime ?? null,
        audioEndTime: input.audioEndTime ?? null,
        songTitle: input.songTitle || null,
        artist: input.artist || null,
        spotifyUrl: input.spotifyUrl || null,
        youtubeUrl: input.youtubeUrl || null,
        direction: input.direction,
        startRow: input.startRow,
        startColumn: input.startColumn,
        orderNumber
      }
    });
    return res.status(201).json({ ...entry, audioUrl: adminAudioUrl(entry.audioPath) });
  })
);

routes.put(
  "/admin/crosswords/:id/entries/:entryId",
  requireAdmin,
  audioUpload.single("audio"),
  asyncRoute(async (req, res) => {
    const id = routeParam(req, "id");
    const entryId = routeParam(req, "entryId");
    const crossword = await prisma.crossword.findUnique({
      where: { id },
      include: { entries: true }
    });
    if (!crossword) return res.status(404).json({ message: "Nie znaleziono krzyzowki." });
    const current = crossword.entries.find((entry) => entry.id === entryId);
    if (!current) return res.status(404).json({ message: "Nie znaleziono hasla." });
    const input = entryInputSchema.parse(req.body);
    const allowInvalidPlacement = req.body.allowInvalidPlacement === "true" && crossword.status === "DRAFT";
    const newAudioPath = req.file ? relativeAudioPath(req.file) : current.audioPath;
    const { errors, normalizedAnswer } = validateEntryBusinessRules(
      input,
      Boolean(newAudioPath),
      crossword.entries,
      crossword.gridRows,
      crossword.gridColumns,
      current.id,
      { validatePlacement: !allowInvalidPlacement }
    );
    if (errors.length) {
      if (req.file) removeLocalFile(newAudioPath);
      return res.status(400).json({ message: "Haslo jest niepoprawne.", errors });
    }
    const entry = await prisma.crosswordEntry.update({
      where: { id: current.id },
      data: {
        type: input.type,
        answer: input.answer.trim(),
        normalizedAnswer,
        clueText: input.clueText || null,
        audioPath: newAudioPath,
        audioStartTime: input.audioStartTime ?? null,
        audioEndTime: input.audioEndTime ?? null,
        songTitle: input.songTitle || null,
        artist: input.artist || null,
        spotifyUrl: input.spotifyUrl || null,
        youtubeUrl: input.youtubeUrl || null,
        direction: input.direction,
        startRow: input.startRow,
        startColumn: input.startColumn,
        orderNumber: input.orderNumber ?? current.orderNumber
      }
    });
    if (req.file && current.audioPath) removeLocalFile(current.audioPath);
    return res.json({ ...entry, audioUrl: adminAudioUrl(entry.audioPath) });
  })
);

routes.delete(
  "/admin/crosswords/:id/entries/:entryId",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const id = routeParam(req, "id");
    const entryId = routeParam(req, "entryId");
    const current = await prisma.crosswordEntry.findFirst({ where: { id: entryId, crosswordId: id } });
    if (!current) return res.status(404).json({ message: "Nie znaleziono hasla." });
    const entry = await prisma.crosswordEntry.delete({ where: { id: current.id } });
    removeLocalFile(entry.audioPath);
    return res.status(204).send();
  })
);

routes.post(
  "/admin/crosswords/:id/publish",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const id = routeParam(req, "id");
    const current = await prisma.crossword.findUnique({
      where: { id },
      include: { entries: true }
    });
    if (!current) return res.status(404).json({ message: "Nie znaleziono krzyzowki." });
    if (current.entries.length < 1) return res.status(400).json({ message: "Plansza musi miec przynajmniej jedno haslo." });
    const layoutErrors = validateCrosswordLayout(current.entries, current.gridRows, current.gridColumns);
    if (layoutErrors.length) {
      return res.status(400).json({ message: "Plansza ma bledy ukladu.", errors: layoutErrors });
    }
    const crossword = await prisma.crossword.update({
      where: { id },
      data: { status: "PUBLISHED", publishedAt: new Date() }
    });
    return res.json(crossword);
  })
);

routes.post(
  "/admin/crosswords/:id/unpublish",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const id = routeParam(req, "id");
    const crossword = await prisma.crossword.update({
      where: { id },
      data: { status: "DRAFT" }
    });
    return res.json(crossword);
  })
);

routes.delete(
  "/admin/crosswords/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const id = routeParam(req, "id");
    const crossword = await prisma.crossword.findUnique({
      where: { id },
      include: { entries: true }
    });
    if (!crossword) return res.status(404).json({ message: "Nie znaleziono krzyzowki." });
    await prisma.crossword.delete({ where: { id: crossword.id } });
    crossword.entries.forEach((entry) => removeLocalFile(entry.audioPath));
    return res.status(204).send();
  })
);
