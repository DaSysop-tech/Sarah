import { describe, expect, it } from "vitest";
import { TaskStore, ValidationError } from "./store.js";

describe("TaskStore", () => {
  it("creates and lists tasks newest-first", () => {
    const store = new TaskStore();
    const a = store.create({ title: "first" });
    const b = store.create({ title: "second" });
    const ids = store.list().map((t) => t.id);
    expect(ids).toEqual([b.id, a.id]);
    expect(a.done).toBe(false);
  });

  it("trims titles and rejects empty ones", () => {
    const store = new TaskStore();
    expect(store.create({ title: "  hello  " }).title).toBe("hello");
    expect(() => store.create({ title: "   " })).toThrow(ValidationError);
  });

  it("toggles done state", () => {
    const store = new TaskStore();
    const task = store.create({ title: "toggle me" });
    expect(store.setDone(task.id, true)?.done).toBe(true);
    expect(store.setDone(task.id, false)?.done).toBe(false);
    expect(store.setDone("missing", true)).toBeUndefined();
  });

  it("removes tasks", () => {
    const store = new TaskStore();
    const task = store.create({ title: "remove me" });
    expect(store.remove(task.id)).toBe(true);
    expect(store.remove(task.id)).toBe(false);
    expect(store.list()).toHaveLength(0);
  });
});
