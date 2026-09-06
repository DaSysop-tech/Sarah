import { useEffect, useMemo, useState } from "react";
import {
  createTask,
  deleteTask,
  fetchTasks,
  setTaskDone,
  type Task,
} from "./api.ts";

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks()
      .then(setTasks)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const remaining = useMemo(
    () => tasks.filter((t) => !t.done).length,
    [tasks],
  );

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const value = title.trim();
    if (!value) return;
    try {
      const task = await createTask(value);
      setTasks((prev) => [task, ...prev]);
      setTitle("");
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function onToggle(task: Task) {
    try {
      const updated = await setTaskDone(task.id, !task.done);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function onDelete(task: Task) {
    try {
      await deleteTask(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main className="app">
      <header className="hero">
        <div className="avatar" aria-hidden>
          S
        </div>
        <div>
          <h1>Sarah</h1>
          <p className="subtitle">Your friendly task assistant</p>
        </div>
      </header>

      <section className="card">
        <form className="composer" onSubmit={onAdd}>
          <input
            aria-label="New task"
            placeholder="What should we get done?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button type="submit">Add</button>
        </form>

        {error && <p className="error">{error}</p>}

        <p className="status">
          {loading
            ? "Loading tasks…"
            : `${remaining} of ${tasks.length} task${tasks.length === 1 ? "" : "s"} remaining`}
        </p>

        <ul className="tasks">
          {tasks.map((task) => (
            <li key={task.id} className={task.done ? "task done" : "task"}>
              <label>
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={() => onToggle(task)}
                />
                <span>{task.title}</span>
              </label>
              <button
                className="delete"
                aria-label={`Delete ${task.title}`}
                onClick={() => onDelete(task)}
              >
                ×
              </button>
            </li>
          ))}
          {!loading && tasks.length === 0 && (
            <li className="empty">No tasks yet — add your first one above.</li>
          )}
        </ul>
      </section>

      <footer className="footer">Built for the Sarah dev environment demo.</footer>
    </main>
  );
}
