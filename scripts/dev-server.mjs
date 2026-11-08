import { createServer } from "node:http";
import { createServer as createVite, loadEnv } from "vite";
import dashboard from "../api/dashboard.ts";
import access from "../api/chat-access.ts";
const env = loadEnv("development", process.cwd(), "");
for (const key of [
  "DASHBOARD_CHAT_ORIGIN",
  "DASHBOARD_CHAT_SECRET",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
])
  if (!process.env[key] && env[key]) process.env[key] = env[key];
process.env.NODE_ENV ??= "development";
const vite = await createVite({
  server: { middlewareMode: true },
  appType: "spa",
});
const server = createServer((req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (path === "/api/dashboard") void dashboard(req, res);
  else if (path === "/api/chat-access") void access(req, res);
  else vite.middlewares(req, res);
});
server.listen(5173, "127.0.0.1", () =>
  console.log("Dashboard + API: http://127.0.0.1:5173"),
);
