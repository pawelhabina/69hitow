import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import multer from "multer";
import { assertRuntimeEnv, env } from "./env.js";
import { routes } from "./routes.js";
import { maxAudioUploadBytes } from "./uploads.js";

assertRuntimeEnv();

const app = express();

app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/api", routes);

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({ message: `Plik audio jest za duzy. Maksymalny rozmiar to ${maxAudioUploadBytes / 1024 / 1024} MB.` });
    return;
  }
  if (error instanceof Error && error.message.includes("MP3")) {
    res.status(400).json({ message: error.message });
    return;
  }
  console.error(error);
  res.status(500).json({ message: "Blad serwera." });
};

app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`Music Crossword API listening on http://localhost:${env.port}`);
});
