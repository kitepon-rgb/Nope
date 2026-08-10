# ChromeBlocker ブランド適用工程（plan: chromeblocker-brand）

`chromeblocker-release` の r7-submit（ストア提出）の前に挟む工程。

## なぜやるか（オーナー裁定 2026-08-10）

ChromeBlocker は直接収入を生まない配布物であり、**kitepon.dev の広告塔**として世に出る。$5 を払って公開する以上、雑な見た目はマスターブランドの信用を直接毀損する。現状のアイコン（猫の線画を Canvas で焼いたもの）と popup（白背景に無機質な白）は、その水準に達していない。

ブランド正本は並行フォルダ `../kitepon.dev/docs/` にある。特に読むべきは:

- `color-system.md` — master palette と使用比率、役割別ルール、禁止事項
- `identity-system.md` — Found / Moved / Proof の設計原則、Typography、Links、Accessibility、Anti-drift

## 確定した仕様（オーナー承認済み。議論の余地なし）

- **マスコットは確定した**: 猫耳の女の子が赤い禁止標識の後ろから顔を出し、片目をつぶって舌を少し出している（テヘッ）。素材は `assets/mascot-source.png`（2048x2048 PNG）。これをそのまま使う——キャラを描き直さない
- **禁止標識は赤**。master palette の Signal Vermilion `#D9432F`。正典では「小面積専用」と定めているが、製品アイコンでの使用はオーナー裁定で承認済み
- **プレースホルダーカードにも同じ絵をそのまま使う**（キャラ単体版を別途作らない）
- **文言から煽りを排除する**: 表示モードの選択肢は「**ブロック表示に置き換え**」と「**非表示にして詰める**」。「あっかんべー」「ざまぁ」等の煽り語は UI・ストア掲載文のいずれにも置かない

## 適用するブランド値

```
--orange: #ef8d32   Discovery Orange  ブランド識別色・発見点・badge
--orange-strong: #c65300  Action Orange  白文字を載せるCTA
--orange-deep: #a84400  Deep Orange  hover・11px以下のlabel
--orange-soft: #fbe5d2  Soft Orange  淡い背景・選択面
--cobalt: #2149aa   Motion Cobalt  軌跡・構造線・技術的な対照
--ink: #111b35      Ink  見出し・本文
--paper: #f8f5ef    Paper  背景
--white: #fffef9    White  card・反転文字
--vermilion: #d9432f  Signal Vermilion  禁止標識
```

面積比の目安: Paper/White 55〜70%、Ink 20〜30%、Orange 7〜12%、Cobalt 3〜8%。

**禁止（正典より）**: `#EF8D32` へ白い通常本文を載せない（白文字が要る面は `#C65300`）。11px 以下の label は `#A84400`。link の文末に `→` `↗` 等の矢印 glyph を付けない。Orange と Cobalt を 50:50 で競わせない。見た目を埋めるだけの図形を足さない。

## タスク

### b1-icons — アイコン3サイズの作り分け

単純縮小は失敗する（実測済み: 16px でキャラが完全に潰れ、赤い丸に斜線だけになる）。サイズごとに作り分ける。

- **128px**: `assets/mascot-source.png` の余白を詰めてリサイズ。キャラが主役として見える
- **48px**: 標識と顔が両立する範囲までトリミングして拡大
- **16px**: キャラを諦め、標識だけを**ベクターで正確に描いて**ラスタライズする。画面いっぱいに標識を置く（単純縮小では余白が多く赤丸が小さくなり識別しづらい）

`manifest.json` の `icons` / `action.default_icon` を差し替える。既存の `icons/icon{16,48,128}.png` を置き換える。

### b2-popup — popup のブランド適用

`popup/popup.css` `popup/popup.html` `popup/popup.js` を上記 master palette へ載せ替える。

- 背景 Paper、文字 Ink、card は White
- 「追加」ボタンは Action Orange `#C65300` に白文字
- 英語の section label（ADD STORE / BLOCKED 等）は 10px・tracking 0.15em・Deep Orange `#A84400`
- ブロック中リストの各行は左端に Discovery Orange の 3px アクセント
- **表示モード切替の文言を「ブロック表示に置き換え」「非表示にして詰める」へ変更**
- フッターに `kitepon.dev` への導線を1つ置く（Cobalt の下線、矢印 glyph なし、`https://kitepon.dev` へ `target="_blank" rel="noopener"`）
- 日本語は `Hiragino Sans` → `Yu Gothic` → `Meiryo`、英語 label と数字は `Manrope` を指定（Web フォントは読み込まない。system fallback で可）

### b3-placeholder — プレースホルダーへのマスコット適用

`src/content-search.js` のプレースホルダーを、現在の猫 SVG からマスコット画像へ差し替える。

- 画像は拡張同梱の PNG を `chrome.runtime.getURL()` で参照する（外部 URL 禁止）
- カード内に収まるサイズへ縮小した専用 PNG を用意する（source をそのまま読ませない。表示サイズに対して 2048px は過大）
- 周囲は White card + Discovery Orange の枠、label は `BLOCKED`（10px・Deep Orange）、その下にストア名（Ink）、解除ボタン（Orange 枠・Deep Orange 文字）
- 既存の解除ボタンの挙動（preventDefault + stopPropagation、CB_STORAGE.removeBlockedStore）は変えない

### b4-verify — 実ブラウザ検証

`agent-browser --headed --extension` で以下を実測する。

- ツールバーと拡張一覧でアイコンが正しく表示される（16/48/128 それぞれ）
- popup がブランド適用後の見た目で描画され、追加・削除・モード切替・キャッシュクリアが従来どおり動く
- 検索結果でブロック済みカードがマスコット付きプレースホルダーに置き換わり、解除ボタンで復元される
- 文言が「ブロック表示に置き換え」「非表示にして詰める」になっている

スクリーンショットを `docs/evidence/` へ置き、ストア掲載用（1280x800）も撮り直す。`docs/store/listing.md` のスクリーンショット表を更新する。

### b5-repackage — 配布物の再生成と smoke

`scripts/pack.mjs` で ZIP を作り直し、**展開先をロードして配布物 smoke** を取る（ソースツリーで動くことは配布物が動く証拠にならない）。`manifest.json` の version を `1.1.0` へ上げる。

## 依存

- b1・b2・b3 は着手時点で独立（並列可）
- b4 は b1・b2・b3 の後
- b5 は b4 の後
- `chromeblocker-release` の r7-submit は b5 の後（plan 跨ぎ依存として接続する）
