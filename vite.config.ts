import { defineConfig, loadEnv } from "vite";
import { deploymentCloudConfig } from "./src/cloud.ts";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), [
    "VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY",
  ]);
  const config = deploymentCloudConfig(env);
  return {
    plugins: [react(), tailwindcss()],
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(config?.url ?? ""),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(config?.key ?? ""),
    },
  };
});
