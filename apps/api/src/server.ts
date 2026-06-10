import cors from "cors";
import express from "express";
import helmet from "helmet";
import { assertRuntimeEnv, env } from "./env.js";
import { routes } from "./routes.js";

assertRuntimeEnv();

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/api", routes);

app.listen(env.port, () => {
  console.log(`Music Crossword API listening on http://localhost:${env.port}`);
});
