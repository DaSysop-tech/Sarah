export interface Task {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
}

export interface CreateTaskInput {
  title: string;
}

/**
 * In-memory task store. Kept intentionally simple so the app runs with no
 * external database, which keeps the Cloud Agent environment self-contained.
 */
export class TaskStore {
  private tasks = new Map<string, Task>();

  list(): Task[] {
    return [...this.tasks.values()].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1,
    );
  }

  create({ title }: CreateTaskInput): Task {
    const trimmed = title.trim();
    if (!trimmed) {
      throw new ValidationError("title must not be empty");
    }
    const task: Task = {
      id: cryptoRandomId(),
      title: trimmed,
      done: false,
      createdAt: new Date().toISOString(),
    };
    this.tasks.set(task.id, task);
    return task;
  }

  setDone(id: string, done: boolean): Task | undefined {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    task.done = done;
    return task;
  }

  remove(id: string): boolean {
    return this.tasks.delete(id);
  }

  clear(): void {
    this.tasks.clear();
  }
}

export class ValidationError extends Error {}

function cryptoRandomId(): string {
  return globalThis.crypto.randomUUID();
}
