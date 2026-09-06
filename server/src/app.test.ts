import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApp } from "./app.js";
import { TaskStore } from "./store.js";

describe("API", () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const app = createApp(new TaskStore());
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
    const { port } = server.address() as AddressInfo;
    base = `http://127.0.0.1:${port}`;
  });

  afterAll(() => {
    server.close();
  });

  it("reports health", async () => {
    const res = await fetch(`${base}/api/health`);
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("ok");
  });

  it("supports the full task lifecycle", async () => {
    const created = await fetch(`${base}/api/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "buy milk" }),
    });
    expect(created.status).toBe(201);
    const { task } = await created.json();
    expect(task.title).toBe("buy milk");

    const patched = await fetch(`${base}/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ done: true }),
    });
    expect((await patched.json()).task.done).toBe(true);

    const deleted = await fetch(`${base}/api/tasks/${task.id}`, {
      method: "DELETE",
    });
    expect(deleted.status).toBe(204);
  });

  it("rejects empty titles", async () => {
    const res = await fetch(`${base}/api/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });
    expect(res.status).toBe(400);
  });
});
