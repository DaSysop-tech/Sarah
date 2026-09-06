import express, { type Express } from "express";
import cors from "cors";
import { TaskStore, ValidationError } from "./store.js";

const SEED_TASKS = [
  "Say hi to Sarah",
  "Read the project README",
  "Ship the first feature",
];

export function createApp(store: TaskStore = new TaskStore()): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "sarah", time: new Date().toISOString() });
  });

  app.get("/api/tasks", (_req, res) => {
    res.json({ tasks: store.list() });
  });

  app.post("/api/tasks", (req, res) => {
    try {
      const task = store.create({ title: String(req.body?.title ?? "") });
      res.status(201).json({ task });
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  });

  app.patch("/api/tasks/:id", (req, res) => {
    const done = Boolean(req.body?.done);
    const task = store.setDone(req.params.id, done);
    if (!task) {
      res.status(404).json({ error: "task not found" });
      return;
    }
    res.json({ task });
  });

  app.delete("/api/tasks/:id", (req, res) => {
    const removed = store.remove(req.params.id);
    if (!removed) {
      res.status(404).json({ error: "task not found" });
      return;
    }
    res.status(204).end();
  });

  return app;
}

export function seed(store: TaskStore): void {
  for (const title of SEED_TASKS) {
    store.create({ title });
  }
}
