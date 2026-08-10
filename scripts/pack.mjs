// 配布用 ZIP を生成するスクリプト。
// 同梱するのは manifest.json / src/ / popup/ / icons/ のみ。
// ZIP のルート直下に manifest.json が来るよう、一時ステージングディレクトリへ
// コピーしてから Compress-Archive (Windows PowerShell 標準搭載、追加依存ゼロ) で固める。
//
// 実行: node scripts/pack.mjs [出力先パス]
//   省略時は dist/chromeblocker-v<manifestのversion>.zip
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const INCLUDE_ENTRIES = ["manifest.json", "src", "popup", "icons"];

function readManifestVersion() {
  const manifest = JSON.parse(
    readFileSync(join(repoRoot, "manifest.json"), "utf-8"),
  );
  return manifest.version;
}

function main() {
  for (const entry of INCLUDE_ENTRIES) {
    const p = join(repoRoot, entry);
    if (!existsSync(p)) {
      throw new Error(`同梱対象が見つからない: ${entry} (${p})`);
    }
  }

  const version = readManifestVersion();
  const outArg = process.argv[2];
  const outPath = outArg
    ? resolve(outArg)
    : join(repoRoot, "dist", `chromeblocker-v${version}.zip`);

  mkdirSync(dirname(outPath), { recursive: true });
  if (existsSync(outPath)) {
    rmSync(outPath);
  }

  const stagingDir = mkdtempSync(join(tmpdir(), "chromeblocker-pack-"));
  try {
    for (const entry of INCLUDE_ENTRIES) {
      cpSync(join(repoRoot, entry), join(stagingDir, entry), {
        recursive: true,
      });
    }

    // ステージング直下の * を圧縮することで、ZIP内にステージングディレクトリ
    // 自体は現れず manifest.json がルート直下に来る。
    const psCommand =
      `Compress-Archive -Path '${stagingDir.replace(/'/g, "''")}\\*' ` +
      `-DestinationPath '${outPath.replace(/'/g, "''")}' -Force`;
    execFileSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", psCommand],
      { stdio: "inherit" },
    );
  } finally {
    rmSync(stagingDir, { recursive: true, force: true });
  }

  console.log(`wrote ${outPath}`);
}

main();
