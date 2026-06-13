import fs from "node:fs";
import path from "node:path";
import type { Request } from "express";
import multer from "multer";

export const uploadRoot = path.resolve(process.cwd(), "uploads");
export const audioUploadDir = path.join(uploadRoot, "audio");

fs.mkdirSync(audioUploadDir, { recursive: true });

export const maxAudioUploadBytes = 50 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: audioUploadDir,
  filename: (_req, file, cb) => {
    const safeBase = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .slice(0, 48);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeBase}.mp3`);
  }
});

export const audioUpload = multer({
  storage,
  limits: { fileSize: maxAudioUploadBytes },
  fileFilter: (_req: Request, file, cb) => {
    if (file.mimetype !== "audio/mpeg") {
      cb(new Error("Dozwolone sa tylko pliki MP3 audio/mpeg."));
      return;
    }
    cb(null, true);
  }
});

export function relativeAudioPath(file: Express.Multer.File) {
  return `uploads/audio/${file.filename}`;
}

export function removeLocalFile(relativePath: string | null | undefined) {
  if (!relativePath) return;
  const filePath = path.resolve(process.cwd(), relativePath);
  if (!filePath.startsWith(uploadRoot)) return;
  fs.promises.rm(filePath, { force: true }).catch(() => undefined);
}
