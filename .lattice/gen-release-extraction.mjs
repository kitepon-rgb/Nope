import { canonicalizeTodoArtifact, todoSelfDigest } from 'file:///C:/Users/kite_/Documents/Program/Lattice/src/todo-contracts.mjs';
import { writeFileSync } from 'node:fs';

const COMMIT = '10d47add8bfe09f173efb3d6af4e97b00218051a';
const ORIGIN = 'docs/plan_chromeblocker-release.md';
const PROJECT = 'ChromeBlocker';
const PLAN = 'chromeblocker-release';

const src = (line, heading) => ({
  origin_plan_ref: ORIGIN, origin_line: line, source_commit: COMMIT,
  heading_path: ['ChromeBlocker リリース工程（plan: chromeblocker-release）', 'タスク', heading],
  markdown_depth: 3, parent_task_id: null, checkbox_state: 'absent',
});
const ctx = (notes, condition = null) => ({
  external_canonical_ref: null, carry_over_ref: null, h_required: false,
  condition, evidence_refs: [], notes,
});
const task = (task_id, title, lane, line, heading, design_memo, migration_context) => ({
  task_id, title, lane, design_memo, narrative_ref: ORIGIN, compile_binding: null,
  disposition: 'register_pending', start: null, completion: null,
  source: src(line, heading), migration_context,
});

const tasks = [
  task('r1-placeholder', 'ブロック表示の2モード実装（あっかんべー / 完全に消す）', 'impl', 25, 'r1-placeholder — ブロック表示の2モード実装',
    `## 目的\nブロック済みカードを既定で「猫があっかんべーするプレースホルダー」に置き換え、popup から「完全に消して詰める」へ切替可能にする。\n\n## 実装\n- **src/storage.js**: \`getDisplayMode()\`（既定 \`"placeholder"\`）/ \`setDisplayMode(mode)\` / \`onDisplayModeChanged(cb)\`。保存先は chrome.storage.sync のキー \`displayMode\`。既存 \`onBlockedStoresChanged\` と同じ流儀。不明値は console.warn を出して既定扱い（静かなフォールバック禁止）\n- **src/content-search.js**: \`findWrapper\` の優先順を ① \`link.closest('[class*="search-item-card-wrapper"]')\` ② \`.card-out-wrapper\` ③ \`parentElement\` へ変更。\`applyVisibility(wrapper, blocked, options)\` を2モード対応に拡張——\`placeholder\`（wrapper の元の子要素を退避して隠し、猫SVG＋「ブロック済み」＋ストア名＋解除ボタンを挿入。解除時は復元）／\`collapse\`（従来どおり wrapper ごと display:none）。class は \`cb-blocked-placeholder\`、二重挿入防止、placeholder では min-height か padding で高さを確保\n- **init**: 起動時に displayMode を読み、onDisplayModeChanged で既知カード全件へ即時再適用\n- **popup/**: 表示モード切替 UI（あっかんべー表示 / 完全に消す）\n- **test**: findWrapper の新優先順、displayMode の既定/保存/購読、applyVisibility のモード分岐を追加。既存43件も新シグネチャへ追随させ全 green（\`node --test test/*.test.mjs\`。\`node --test test/\` は Windows で失敗する）\n\n## 罠\n- ストア名は textContent で入れる（innerHTML に混ぜない＝XSS防止）。SVG は定数のみを innerHTML に渡す\n- 解除ボタンの click は preventDefault + stopPropagation（カード全体が a タグのため遷移してしまう）\n- 猫SVG の構図は承認済みラフを維持（禁止マークの後ろから顔を出してあっかんべー）\n\n## 途中成果\nsonnet worker が \`src/storage.js\` に \`DEFAULT_DISPLAY_MODE\`／\`ALLOWED_DISPLAY_MODES\`／\`normalizeDisplayMode\` を追加済み（未コミット）。plan mode により中断したもので、続きから拾ってよい。`,
    ctx(['猫SVGの構図はオーナー承認済み（禁止マークの後ろから顔を出してあっかんべー、片目ウインク）', '未コミットの src/storage.js 途中成果あり——定数追加まで完了'])),

  task('r2-placeholder-verify', 'placeholder / collapse の実ブラウザ実測と evidence 整備', 'verify', 29, 'r2-placeholder-verify — 実ブラウザ実測',
    `## 受入条件（すべて実ブラウザで確認する）\n1. 検索結果ページでブロック済みストアのカードが猫プレースホルダーに置き換わる\n2. プレースホルダーの「解除」ボタンでブロックが外れ、元のカードが復元される（親リンクへ遷移しない）\n3. popup で「完全に消す」へ切り替えると、リロード無しでカードが消え、**後続カードが前へ詰まる**（getBoundingClientRect の座標シフトで確認）\n4. 「あっかんべー表示」へ戻すとプレースホルダー表示に復帰する\n\n## 手段\n\`agent-browser close --all\` → \`agent-browser --headed --extension "C:/Users/kite_/Documents/Program/ChromeBlocker" open <検索URL>\` → \`wait\` → \`eval\` の同期コマンドで実測。検索語は \`https://ja.aliexpress.com/w/wholesale-CMP-170HX.html\`（NailNest Store / 1100223114 が出る）。\n\n## evidence\nスクリーンショットを docs/evidence/ へ置き、r2 の evidence md にまとめる。\n\n**併せてストア掲載用のスクリーンショットも撮る**（1280x800、ブロック前の検索結果 / プレースホルダー表示 / popup の3枚）。r6 の掲載物はこれを使う。`,
    ctx(['実測は同期コマンド（open → wait → eval）で行う。非同期の完了通知待ちはサブエージェントに届かない', 'ストア掲載用スクリーンショット（1280x800）もこの task で撮る——実測と同じブラウザセッションで済むため'])),

  task('r3-icons', 'アイコン（16/48/128）作成と manifest 版数更新', 'assets', 33, 'r3-icons — アイコンと版数',
    `猫キャラを流用した 16x16 / 48x48 / 128x128 の PNG を \`icons/\` に作り、\`manifest.json\` に \`icons\` フィールドと \`action.default_icon\` を追加。version を \`0.1.0\` → \`1.0.0\` へ。\n\nPNG 生成手段は問わない（SVG から sharp/resvg 等でラスタライズ、または Canvas）。外部サービスへの送信は禁止。128px は Chrome Web Store の掲載でも使われるため、縮小しても潰れない太めの線で作ること。`,
    ctx(['Chrome Web Store は 128px アイコンを掲載に使う', '拡張が動くこと自体には icons は必須ではないが、ストア提出には必要'])),

  task('r4-github', 'GitHub public repo 作成・README 整備・push', 'release', 37, 'r4-github — public repo 作成と push',
    `\`gh repo create ChromeBlocker --public\` で作成し remote を追加、main を push する（**この repo は push を既定とする恒久裁定が無いため、この task の実行自体がオーナーの明示指示にあたる**）。\n\nREADME に含めるもの: 何をする拡張か、スクリーンショット、導入手順（ストア公開前は Load unpacked、公開後はストアリンク）、プライバシー記述（外部送信なし・保存は chrome.storage のみ・収集データなし）、ライセンス。\n\n\`.gitignore\` に \`.team/\` などの作業用ディレクトリを入れるかは判断してよいが、\`.lattice/\` は工程正本なので**除外しない**。`,
    ctx(['public repo はオーナー承認済み', 'プライバシーポリシーの掲載先としてストア提出でも使う'])),

  task('r5-package', '配布 ZIP 生成と配布物 smoke', 'release', 41, 'r5-package — 配布 ZIP と配布物 smoke',
    `配布 ZIP を作るスクリプト（\`scripts/pack.mjs\` 等）を用意する。同梱するのは \`manifest.json\` \`src/\` \`popup/\` \`icons/\` **のみ**。\`.lattice/\` \`.team/\` \`.claude/\` \`docs/\` \`test/\` \`.codex-sidecar.yml\` は除外する。\n\n**配布物 smoke が受入条件**——生成した ZIP を別ディレクトリへ展開し、その展開先を \`agent-browser --extension\` でロードして、popup が開き検索ページでブロックが効くことを確認する。ソースツリーで動くことは配布物が動く証拠にならない（Lattice で同型の欠陥を踏んでいる）。`,
    ctx(['配布物 smoke は「ソースツリーだけ検査して出荷物を検査しない」欠陥への対策。Lattice で実際に踏んだ型'])),

  task('r6-store-listing', 'ストア掲載物（説明文・スクリーンショット・プライバシー申告）', 'release', 45, 'r6-store-listing — ストア掲載物',
    `2026-08-01 から Chrome Web Store のプライバシー審査が厳格化されている。用意するもの:\n- **単一目的の宣言**: 「AliExpress の検索結果から、ユーザーが指定したストアの商品を非表示にする」の1文で説明できる形にする\n- **権限の正当化**: \`storage\`（ブロックリストの保存）と \`*://*.aliexpress.com/*\` への content script（カードの判定と非表示）それぞれについて、なぜ必要かを書く\n- **プライバシー申告**: 収集データなし・外部送信なし・第三者への販売なし。ダッシュボードの Privacy practices タブの申告と README/ポリシー文面を食い違わせない\n- **説明文**: 日本語。誇大表現を避ける\n\nスクリーンショット（1280x800）の撮影は r2 が行うので、ここでは掲載順とキャプションの決定だけ行う。文面は実装の完了を待たずに書ける。\n\n注意: mtop API を叩いて productId→storeId を解決している点は「拡張の単一目的に必要な処理」として説明できるようにしておく（AliExpress 自身のエンドポイントであり、外部サーバーへは何も送っていない）。`,
    ctx(['2026-08-01 から single purpose / データ申告 / 権限正当化の審査が厳格化', 'mtop 経路は AliExpress 自身の API。外部送信ではないことを明記する'])),

  task('r7-submit', 'ストア提出・審査・公開後の Mac smoke', 'release', 49, 'r7-submit — 提出と公開',
    `1. **オーナー作業**: Chrome Web Store デベロッパー登録と初回 $5 の支払い（アカウント作成・支払いはエージェントが行わない）\n2. ZIP をアップロードし、掲載情報とプライバシー申告を入力、可視性 **unlisted** で提出\n3. 審査（数日〜数週間。2026年4月時点で提出増により延伸中との公式案内あり）\n4. 公開後、Mac の Chrome へストアリンクからインストールし、検索でブロックが効くことを smoke で確認する\n\nこの task は外部依存（審査）を含むため、提出まで進めた時点で一度 blocked にして審査待ちを明示すること。`,
    ctx(['$5 の支払いとアカウント作成はオーナーのみ。エージェントは代行しない'], '審査通過（外部依存）')),
];

const dep = (from, to) => ({
  from: { project_id: PROJECT, plan_key: PLAN, task_id: from },
  to: { project_id: PROJECT, plan_key: PLAN, task_id: to },
});

const extraction = {
  schema: 'lattice.todo_extraction.v3',
  project_id: PROJECT,
  plan_key: PLAN,
  plan_version: 'v1',
  actor: { host: 'FOX', session: 'f23bd994', agent: 'bell' },
  recorded_at: process.argv[2],
  tasks,
  hard_dependencies: [
    dep('r1-placeholder', 'r2-placeholder-verify'),
    dep('r2-placeholder-verify', 'r7-submit'),
    dep('r3-icons', 'r5-package'),
    dep('r4-github', 'r7-submit'),
    dep('r5-package', 'r7-submit'),
    dep('r6-store-listing', 'r7-submit'),
  ],
  joins: [],
};
extraction.extraction_digest = todoSelfDigest(extraction, 'extraction_digest');
writeFileSync('C:/Users/kite_/Documents/Program/ChromeBlocker/.lattice/release-extraction.json',
  canonicalizeTodoArtifact(extraction) + '\n');
console.log('written; tasks=' + tasks.length + ' deps=' + extraction.hard_dependencies.length);
