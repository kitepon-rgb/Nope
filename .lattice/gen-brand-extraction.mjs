import { canonicalizeTodoArtifact, todoSelfDigest } from 'file:///C:/Users/kite_/Documents/Program/Lattice/src/todo-contracts.mjs';
import { writeFileSync } from 'node:fs';

const COMMIT = 'dce67fd7f442bbe01afb4ed7a67213b424bf34d5';
const ORIGIN = 'docs/plan_chromeblocker-brand.md';
const PROJECT = 'ChromeBlocker';
const PLAN = 'chromeblocker-brand';

const BRAND = `## ブランド正本\n並行フォルダ \`../kitepon.dev/docs/color-system.md\` と \`identity-system.md\` が正本。着手前に必ず読むこと。私の要約は正本ではない。\n\n## 適用値\n\`--orange #ef8d32\`(識別色・発見点) / \`--orange-strong #c65300\`(白文字を載せるCTA) / \`--orange-deep #a84400\`(hover・11px以下のlabel) / \`--orange-soft #fbe5d2\` / \`--cobalt #2149aa\`(軌跡・構造線) / \`--ink #111b35\`(文字) / \`--paper #f8f5ef\`(背景) / \`--white #fffef9\`(card) / Signal Vermilion \`#d9432f\`(禁止標識)\n\n面積比: Paper/White 55〜70%、Ink 20〜30%、Orange 7〜12%、Cobalt 3〜8%。\n\n## 禁止（正典より）\n\`#EF8D32\` へ白い通常本文を載せない。11px以下のlabelは \`#A84400\`。linkの文末に矢印glyph(→ ↗ ↓)を付けない。OrangeとCobaltを50:50で競わせない。見た目を埋めるだけの図形を足さない。`;

const src = (line, heading) => ({
  origin_plan_ref: ORIGIN, origin_line: line, source_commit: COMMIT,
  heading_path: ['ChromeBlocker ブランド適用工程（plan: chromeblocker-brand）', 'タスク', heading],
  markdown_depth: 3, parent_task_id: null, checkbox_state: 'absent',
});
const ctx = (notes) => ({
  external_canonical_ref: null, carry_over_ref: null, h_required: false,
  condition: null, evidence_refs: [], notes,
});
const task = (task_id, title, lane, line, heading, memo, notes) => ({
  task_id, title, lane, design_memo: memo, narrative_ref: ORIGIN, compile_binding: null,
  disposition: 'register_pending', start: null, completion: null,
  source: src(line, heading), migration_context: ctx(notes),
});

const tasks = [
  task('b1-icons', 'アイコン3サイズの作り分け（単純縮小は失敗する）', 'assets', 43, 'b1-icons — アイコン3サイズの作り分け',
    `## 実測済みの事実（疑わないこと）\n\`assets/mascot-source.png\`(2048x2048、オーナー確定済みのマスコット)を単純縮小すると、**16pxでキャラが完全に潰れ赤い丸に斜線だけになる**。48pxでようやく「中に何かいる」程度。bellが実測済み。\n\n## やること\nサイズごとに作り分ける。\n- **128px**: source の余白を詰めてリサイズ。キャラが主役として見える\n- **48px**: 標識と顔が両立する範囲までトリミングして拡大\n- **16px**: キャラを諦め、**赤い禁止標識だけをベクターで正確に描いて**ラスタライズする。画面いっぱいに標識を置く（単純縮小は余白が多く赤丸が小さくなる）。色は Signal Vermilion \`#d9432f\`\n\n\`icons/icon{16,48,128}.png\` を差し替え、\`manifest.json\` の \`icons\` / \`action.default_icon\` を確認する（パスが変わらないなら manifest は触らなくてよい）。\n\n## 手段\n追加依存を入れない。PowerShell の System.Drawing か agent-browser の Canvas を使う（前回 r3-icons で hiyori が実証した経路が \`docs/evidence/r3-icons.md\` にある）。**生成した PNG は必ず Read tool で開いて目視確認すること**——「生成した」で終わらせない。\n\n## 検証\n\`agent-browser --headed --extension\` で \`chrome://extensions\` を開き、拡張カードにアイコンが表示されることを確認する。\n\n${BRAND}`,
    ['マスコットはオーナー確定済み。描き直さない', '単純縮小の失敗はbellが実測済み']),

  task('b2-popup', 'popup のブランド適用と文言修正', 'ui', 52, 'b2-popup — popup のブランド適用',
    `## やること\n\`popup/popup.css\` \`popup/popup.html\` \`popup/popup.js\` を master palette へ載せ替える。現状は白背景に無機質な白で、オーナーから明確に駄目出しが出ている。\n\n- 背景 Paper \`#f8f5ef\`、文字 Ink \`#111b35\`、card は White \`#fffef9\`\n- 「追加」ボタンは Action Orange \`#c65300\` に白文字（\`#ef8d32\` に白文字は正典で禁止）\n- 英語の section label（ADD STORE / BLOCKED 等）は 10px・letter-spacing 0.15em・Deep Orange \`#a84400\`\n- ブロック中リストの各行は左端に Discovery Orange \`#ef8d32\` の 3px アクセント\n- **表示モード切替の文言を「ブロック表示に置き換え」「非表示にして詰める」へ変更する**（「あっかんべー」は煽りなのでオーナー裁定で不可）\n- フッターに \`kitepon.dev\` への導線を1つ置く。\`https://kitepon.dev\` へ \`target="_blank" rel="noopener"\`、Cobalt \`#2149aa\` の下線1px・underline-offset 3px、**矢印glyphを付けない**（正典の Links 規定）\n- font-family: 日本語は \`Hiragino Sans\`→\`Yu Gothic\`→\`Meiryo\`、英語labelと数字は \`Manrope\`。**Web フォントは読み込まない**（拡張なので外部取得禁止、system fallback で可）\n\n## 壊してはいけないもの\n追加・削除・キャッシュクリア・表示モード切替の既存挙動と、\`popup.js\` が呼ぶ CB_STORAGE の API。unit test（\`test/popup.test.mjs\`）が通ること。文言を変えるならテストの期待値も追随させる。\n\n${BRAND}`,
    ['「あっかんべー」表記はオーナー裁定で不可。煽り語をUIに置かない']),

  task('b3-placeholder', 'プレースホルダーへのマスコット適用', 'ui', 66, 'b3-placeholder — プレースホルダーへのマスコット適用',
    `## やること\n\`src/content-search.js\` のプレースホルダーを、現在の猫SVGから**マスコット画像**へ差し替える。オーナー裁定で「\`assets/mascot-source.png\` の絵をそのまま使う」と確定している（キャラ単体版を別途作らない）。\n\n- 画像は拡張に同梱し \`chrome.runtime.getURL()\` で参照する（**外部URL禁止**）。\`web_accessible_resources\` への登録が要るかを実機で確認すること\n- **表示サイズに合わせた PNG を用意する**。2048px の source をそのまま content script に読ませない（カード内では 120px 程度）\n- カードは White \`#fffef9\` 地に Discovery Orange \`#ef8d32\` の枠、label は \`BLOCKED\`（10px・letter-spacing 0.14em・Deep Orange \`#a84400\`）、その下にストア名（Ink、textContent で入れる＝XSS防止）、解除ボタン（Orange枠・Deep Orange文字）\n- **既存の解除ボタンの挙動を変えない**: click で preventDefault + stopPropagation（カード全体が a タグなので、これが無いと商品ページへ飛ぶ）、CB_STORAGE.removeBlockedStore を呼ぶ\n- collapse モード（display:none で詰める）の挙動も変えない\n\n## 壊してはいけないもの\n\`test/content-search.test.mjs\` の既存テスト。DOM構造を変えるなら期待値も追随させる。\n\n${BRAND}`,
    ['マスコットはそのまま使う（オーナー裁定）', '解除ボタンのpreventDefault+stopPropagationは死守。無いと商品ページへ遷移する']),

  task('b4-verify', 'ブランド適用後の実ブラウザ検証と掲載画像の撮り直し', 'verify', 80, 'b4-verify — 実ブラウザ検証',
    `## 受入条件（すべて実ブラウザで確認する）\n1. ツールバーと拡張一覧でアイコンが正しく表示される（16/48/128 それぞれ）\n2. popup がブランド適用後の見た目で描画され、追加・削除・モード切替・キャッシュクリアが従来どおり動く\n3. 検索結果でブロック済みカードがマスコット付きプレースホルダーに置き換わり、解除ボタンで復元される（**親リンクへ遷移しないこと**）\n4. 文言が「ブロック表示に置き換え」「非表示にして詰める」になっている\n5. 「非表示にして詰める」へ切り替えると後続カードが前へ詰まる（getBoundingClientRect の数値で確認。印象で判断しない）\n\n## 手段\n\`agent-browser close --all\` → \`agent-browser --headed --extension "C:/Users/kite_/Documents/Program/ChromeBlocker" open <url>\` → \`wait\` → \`eval\` の同期コマンド。検索語は \`https://ja.aliexpress.com/w/wholesale-CMP-170HX.html\`。AliExpress の bot 対策で mtop 解決が落ちる時は、\`chrome.storage.local\` の \`productStoreCache\` へ既知の対応（productId 1005012897132115 → storeId 1100223114）を仕込んでキャッシュ命中経路で検証してよい（前回 kotoha が取った方法。モックではなく正規機構を使う実測）。\n\n## 併せてやること\nストア掲載用スクリーンショット（1280x800）を撮り直し、\`docs/store/listing.md\` のスクリーンショット表を更新する。旧デザインの画像が掲載表に残らないようにすること。\n\n## 不具合を見つけたら\n直さず room へ報告する。実装担当が直す。`,
    ['実測は同期コマンド(open→wait→eval)で行う。非同期の完了通知はサブエージェントに届かない']),

  task('b5-repackage', '配布物の再生成と配布物smoke', 'release', 88, 'b5-repackage — 配布物の再生成と smoke',
    `## やること\n\`scripts/pack.mjs\` で配布 ZIP を作り直す。\`manifest.json\` の version を \`1.0.0\` → \`1.1.0\` へ上げる。\n\n## 受入条件は配布物smokeだ\n**ソースツリーで動くことは配布物が動く証拠にならない。** 生成した ZIP を別ディレクトリへ展開し、その展開先を \`agent-browser --extension "<展開先>"\` でロードして、①アイコンが出る ②popup がブランド適用後の見た目で開く ③検索ページでマスコット付きプレースホルダーが出る、を実測すること。\n\nマスコット画像が ZIP に同梱されているかを必ず確認する（\`icons/\` 以外に画像を置いた場合、pack.mjs の同梱対象に入っていないと配布物だけ画像が欠ける——これは「テストは通るのに install したら壊れる」の典型形）。`,
    ['pack.mjsの同梱対象にマスコット画像が入っているか要確認。漏れると配布物だけ壊れる']),
];

const dep = (from, to) => ({
  from: { project_id: PROJECT, plan_key: PLAN, task_id: from },
  to: { project_id: PROJECT, plan_key: PLAN, task_id: to },
});

const extraction = {
  schema: 'lattice.todo_extraction.v3',
  project_id: PROJECT, plan_key: PLAN, plan_version: 'v1',
  actor: { host: 'FOX', session: 'f23bd994', agent: 'bell' },
  recorded_at: process.argv[2],
  tasks,
  hard_dependencies: [
    dep('b1-icons', 'b4-verify'),
    dep('b2-popup', 'b4-verify'),
    dep('b3-placeholder', 'b4-verify'),
    dep('b4-verify', 'b5-repackage'),
  ],
  joins: [],
};
extraction.extraction_digest = todoSelfDigest(extraction, 'extraction_digest');
writeFileSync('C:/Users/kite_/Documents/Program/ChromeBlocker/.lattice/brand-extraction.json',
  canonicalizeTodoArtifact(extraction) + '\n');
console.log('written tasks=' + tasks.length);
