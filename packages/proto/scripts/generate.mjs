/**
 * Optional full protobuf-es generation entrypoint.
 *
 * Requires `protoc` and installs `@bufbuild/protoc-gen-es` from this package.
 * Generated files land under src/gen/ and can supersede the hand-mirrored types.
 *
 * Run: pnpm --filter @hasu-gallery/proto generate
 */
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(packageRoot, "../..");
const protoRoot = path.join(repoRoot, "proto");
const outDir = path.join(packageRoot, "src", "gen");

mkdirSync(outDir, { recursive: true });

const protoc = process.env.PROTOC || "protoc";
const plugin = path.join(
  packageRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "protoc-gen-es.cmd" : "protoc-gen-es",
);

const args = [
  `--proto_path=${protoRoot}`,
  `--es_out=${outDir}`,
  `--es_opt=target=ts`,
  `--plugin=protoc-gen-es=${plugin}`,
  path.join(protoRoot, "hasu/gallery/v2/common.proto"),
  path.join(protoRoot, "hasu/gallery/v2/fiction.proto"),
  path.join(protoRoot, "hasu/gallery/v2/works.proto"),
];

const result = spawnSync(protoc, args, { stdio: "inherit", shell: process.platform === "win32" });
if (result.status !== 0) {
  console.error(
    "protobuf-es generation failed. Hand-mirrored types in src/index.ts remain the default export.",
  );
  process.exit(result.status ?? 1);
}

console.log(`generated protobuf-es types under ${outDir}`);
