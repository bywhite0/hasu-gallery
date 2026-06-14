import { defineConfig } from "@rspack/cli";
import { rspack } from "@rspack/core";
import ReactRefreshPlugin from "@rspack/plugin-react-refresh";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV !== "production";

export default defineConfig({
  context: __dirname,
  entry: { main: "./src/main.tsx" },
  resolve: {
    extensions: ["...", ".ts", ".tsx", ".jsx"],
    alias: { "@": path.resolve(__dirname, "src") },
  },
  module: {
    rules: [
      {
        test: /\.(j|t)sx?$/,
        use: {
          loader: "builtin:swc-loader",
          options: {
            jsc: {
              parser: { syntax: "typescript", tsx: true },
              transform: {
                react: {
                  runtime: "automatic",
                  development: isDev,
                  refresh: isDev,
                },
              },
            },
          },
        },
        type: "javascript/auto",
      },
      {
        test: /\.css$/,
        type: "css",
        use: ["postcss-loader"],
      },
    ],
  },
  plugins: [
    new rspack.HtmlRspackPlugin({ template: "./index.html" }),
    isDev && new ReactRefreshPlugin(),
  ].filter(Boolean),
  devServer: {
    port: 5173,
    historyApiFallback: true,
    proxy: [
      {
        context: ["/api"],
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    ],
  },
  experiments: { css: true },
});
