import { createApp, seed } from "./app.js";
import { TaskStore } from "./store.js";

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";

const store = new TaskStore();
seed(store);

const app = createApp(store);

app.listen(PORT, HOST, () => {
  console.log(`[sarah] API listening on http://${HOST}:${PORT}`);
});
