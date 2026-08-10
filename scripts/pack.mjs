// 配布用 ZIP を生成するスクリプト。
// 同梱するのは manifest.json / src/ / popup/ / icons/ / assets/mascot-blocked.png のみ。
// assets/mascot-source.png(2048x2048、開発用の原本)は実行時に参照されないため、
// 配布物に含めない。ディレクトリ丸ごとではなく個別ファイルとして指定することで除外している。
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

const INCLUDE_ENTRIES = [
  "manifest.json",
  "src",
  "popup",
  "icons",
  "assets/mascot-blocked.png",
];

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
      const dest = join(stagingDir, entry);
      // entry が "assets/mascot-blocked.png" のようなネストしたファイルの場合、
      // 親ディレクトリ(stagingDir/assets/)を先に作っておく必要がある。
      mkdirSync(dirname(dest), { recursive: true });
      cpSync(join(repoRoot, entry), dest, {
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
