import { writeFileSync } from 'node:fs';
import {
  canonicalizeTodoArtifact,
  todoSelfDigest,
} from 'file:///Users/kite/Developer/Lattice/src/todo-contracts.mjs';

const COMMIT = '8130742be60336494a5ef8dfbcd46b830e2289b6';
const ORIGIN = 'docs/plan_nope-youtube-home.md';
const PROJECT = 'ChromeBlocker';
const PLAN = 'nope-youtube-home';

const source = (line, heading) => ({
  origin_plan_ref: ORIGIN,
  origin_line: line,
  source_commit: COMMIT,
  heading_path: [
    'YouTube 推薦面ブロック再設計（plan: nope-youtube-home）',
    'タスク',
    heading,
  ],
  markdown_depth: 3,
  parent_task_id: null,
  checkbox_state: 'absent',
});

const context = (notes, options = {}) => ({
  external_canonical_ref: null,
  carry_over_ref: options.carryOver ?? null,
  h_required: options.hRequired ?? false,
  condition: options.condition ?? null,
  evidence_refs: [],
  notes,
});

const task = ({ id, title, lane, line, heading, memo, migrationContext }) => ({
  task_id: id,
  title,
  lane,
  design_memo: memo,
  narrative_ref: ORIGIN,
  compile_binding: null,
  disposition: 'register_pending',
  start: null,
  completion: null,
  source: source(line, heading),
  migration_context: migrationContext,
});

// tasks と hard_dependencies は canonical contract に合わせて task_id 順に置く。
const tasks = [
  task({
    id: 'yt-contract-tests',
    title: 'YouTube推薦面のUI契約と失敗テスト',
    lane: 'design',
    line: 33,
    heading: 'yt-contract-tests — UI契約と失敗テスト',
    memo: `## 目的
実DOM調査と旧導線監査を統合し、実装に先立って推薦面の契約と失敗テストを確定する。

## 入力
- docs/survey/youtube-home-search.md
- docs/evidence/youtube-flow-audit.md
- docs/plan_nope-youtube-home.md の成功条件と非対象

## 成果
- docs/design-youtube-surfaces.md に、ホーム・検索・視聴ページの介入境界、カード契約、識別子、正規化、hover/focus、即時反映、解除、SPA追従を記す
- 実DOMから縮約した fixture を用い、実装前に赤くなるテストを追加する
- storage へ完成済みブロック値を直接入れるだけでなく、UI登録→共有反映→解除の利用者導線を検証する
- 視聴ページに Nope UI とフィルタが無いことを負のテストにする

## 禁止
調査結果と異なるDOMをテスト都合で発明しない。正規化不能を表示名マッチで埋めない。実装コードはこのtaskで直さない。`,
    migrationContext: context([
      '旧受入はstorage直投入だけで登録入口の欠落を見逃したため、利用者導線を契約に含める',
      '実装taskより先に赤いテストを確定する',
    ], { carryOver: 'nope-v2:v3-adapter-id,v4-adapter-name' }),
  }),
  task({
    id: 'yt-dom-survey',
    title: 'YouTubeホーム・検索の実DOM調査',
    lane: 'discovery',
    line: 25,
    heading: 'yt-dom-survey — ホーム・検索の実DOM調査',
    memo: `## 目的
YouTube ホームと検索の現行DOMを、既存fixtureから推測せず実ブラウザで測る。

## 実測項目
- ホームと検索それぞれの動画カード境界とレイアウトwrapper
- チャンネルリンクの実href（/@handle、/channel/UC...、他形式）と表示名
- hover と keyboard focus で操作UIを置ける位置
- SPA遷移、DOM差し替え、無限スクロールで追加されるカードの形
- 同一チャンネルがhandle/UCの両形式で現れるか、DOMだけで正規化できるか

## 成果
docs/survey/youtube-home-search.md にURL、取得日時、DOM抜粋、件数、判断、未到達条件を記録する。ログアウト状態でホームが空なら成功扱いせず、オーナー通常ChromeでのH実測が必要と明記する。

## 境界
調査taskでは製品コードとテストを変更しない。`,
    migrationContext: context([
      '旧工程ではYouTubeホームを未ログインだけで対象外にした',
      'fixture先行は禁止。実DOMを先に正本化する',
    ], { carryOver: 'nope-v2:terminal-audit' }),
  }),
  task({
    id: 'yt-flow-audit',
    title: 'YouTube旧導線と対象面の監査',
    lane: 'audit',
    line: 29,
    heading: 'yt-flow-audit — 旧導線と対象面の監査',
    memo: `## 目的
現行コードで、検索の登録入口が欠けた理由と関連動画ボタンが出なかった理由を、実物の呼出し経路から特定する。

## 読む範囲
manifest.json、src/content-search.js、src/content-name.js、src/adapters/youtube.js、src/adapters/youtube_watch.js、src/storage.js、popup、YouTube関連tests、公開説明。

## 成果
docs/evidence/youtube-flow-audit.md に、面ごとのcontent script、adapter、保存ID、UI入口、再適用、解除の流れを記し、次を断定できる証拠を置く。
- ホームへ現状何が注入されるか
- 検索が保存済み値を適用できても登録できない原因
- 視聴ページの関連動画ボタンが出ない原因
- 撤去すべきwatch面のコード・manifest・文書・テスト

## 境界
監査taskでは製品コードとテストを変更しない。コミット要約を根拠にせず現在のコードを読む。`,
    migrationContext: context([
      'オーナー実測で検索は登録入口欠落、watch関連はボタン非表示が判明',
      '原因と変更面を実物から確定して次taskへ渡す',
    ], { carryOver: 'nope-v2:v3-adapter-id,v4-adapter-name' }),
  }),
  task({
    id: 'yt-home-search',
    title: 'YouTubeホーム＋検索の共通ブロック導線',
    lane: 'impl',
    line: 37,
    heading: 'yt-home-search — ホーム＋検索の共通ブロック導線',
    memo: `## 目的
ホームを主対象、検索を副対象として、同一のチャンネルブロック操作とリストを実装する。

## 受入
- ホームと検索のカードにhover/focusでブロック操作が現れる
- /@handle または /channel/UC... に基づく安定識別子を保存し、調査で確定した正規化を適用する
- クリック直後に同じ面の同一チャンネルが再描画され、ホームと検索をまたいで共有される
- プレースホルダーは元カード高を保ち、解除ボタンとpopupの双方で復元する
- SPA遷移と無限スクロール後の新規カードにも効く
- yt-contract-tests の失敗テストをgreenにする

## 境界
YouTube以外のサイトを変えない。キーワードブロックをホームへ追加しない。表示名だけの識別子へ退行しない。watch関連動画へ介入しない。`,
    migrationContext: context([
      '主対象はYouTubeホーム、検索は同じ操作とリストを共有する副対象',
      '元カード高維持と解除はYahoo Newsでオーナー受入済みの品質を維持する',
    ]),
  }),
  task({
    id: 'yt-package-smoke',
    title: 'YouTube推薦面の再梱包と実Chrome受入',
    lane: 'release',
    line: 45,
    heading: 'yt-package-smoke — 自動検証・再梱包・実Chrome受入',
    memo: `## 自動検証
変更直結テストを確認後、全テストを1回実行する。scripts/pack.mjs で dist/chromeblocker-v2.0.0.zip を再生成し、隔離展開した配布物をロードしてmanifest、popup、同梱ファイルをsmokeする。

## オーナー実Chrome受入（H）
ログイン済みYouTubeで次を1つずつ確認する。
1. ホームの登録、ブロック、高さ維持、解除
2. 検索の登録、ブロック、解除
3. ホームと検索をまたぐ共有リスト
4. SPA遷移と追加カードへの追従
5. 視聴ページ関連動画にNopeのUIもフィルタも無い

## 証跡
docs/evidence/youtube-home-search-smoke.md にテスト件数、ZIP SHA-256、隔離展開smoke、オーナー受入結果を記録する。自動化ブラウザでログイン面へ届かなければ成功扱いせず、H条件の手前で待つ。`,
    migrationContext: context([
      'ソースツリーでなく再生成ZIPの隔離展開版を検査する',
      'ログイン済み通常Chromeでの最終確認はオーナー操作を要する',
    ], {
      hRequired: true,
      condition: 'オーナーのログイン済みChromeでYouTubeホーム・検索・視聴ページの受入が完了すること',
    }),
  }),
  task({
    id: 'yt-terminal-audit',
    title: 'YouTube推薦面再設計の終端監査',
    lane: 'audit',
    line: 57,
    heading: 'yt-terminal-audit — 別席による終端監査',
    memo: `## 目的
実装席とは別の席が、成果をコード・テスト・配布物・実Chrome証跡から反証する。

## 必須反証
- UI登録を通らずstorage直投入だけでgreenになっていないか
- 表示名だけのIDやhandle/UC片側だけへ退行していないか
- ホームだけ、または検索だけに効く分断がないか
- watch関連動画のcontent script、adapter、UI、フィルタ、公開説明が残っていないか
- 配布ZIPが最新ソースと必要資産を含むか
- H受入が未実施なのに完了扱いされていないか

## 報告
円卓へ受理または具体的な異議を投稿し、docs/evidence/youtube-home-terminal-audit.md に根拠を残す。異議があれば自分で実装修正せず、該当taskを再開させる。`,
    migrationContext: context([
      '実装担当と別席が監査する',
      '円卓の監査発言とevidenceの双方を終端受理の根拠にする',
    ]),
  }),
  task({
    id: 'yt-watch-retire',
    title: 'YouTube関連動画への介入撤去',
    lane: 'impl',
    line: 41,
    heading: 'yt-watch-retire — 関連動画への介入撤去',
    memo: `## 目的
視聴ページの関連動画を発信元ブロック対象から外し、Nopeが介入しない状態にする。

## 変更
- manifest.json のYouTube watch専用content script登録を撤去する
- src/adapters/youtube_watch.js と専用テストを削除する。共通機構の他サイト利用を巻き込まない
- README、docs/store/listing.md、privacy、submission checklistなどの公開説明を「YouTubeホーム＋検索」へ合わせる
- 視聴ページ関連動画にNope UIもプレースホルダーも出ない負のテストを維持する

## 境界
関連動画の別機能を追加しない。YouTube以外の表示名adapterを削除しない。履歴文書の完了記録は過去の証跡なので改竄せず、現在仕様の説明だけを更新する。`,
    migrationContext: context([
      'オーナー裁定: 関連動画は見たい可能性が高いため対象外',
      'コードだけでなくmanifestと現在仕様の公開説明も撤去対象',
    ], { carryOver: 'nope-v2:v4-adapter-name' }),
  }),
];

const nodeRef = (taskId) => ({
  project_id: PROJECT,
  plan_key: PLAN,
  task_id: taskId,
});

const dependency = (from, to) => ({
  from: nodeRef(from),
  to: nodeRef(to),
});

const extraction = {
  schema: 'lattice.todo_extraction.v3',
  project_id: PROJECT,
  plan_key: PLAN,
  plan_version: 'v1',
  actor: { host: 'mac', session: 'codex-nope', agent: 'bell' },
  recorded_at: process.argv[2],
  tasks,
  hard_dependencies: [
    dependency('yt-contract-tests', 'yt-home-search'),
    dependency('yt-contract-tests', 'yt-watch-retire'),
    dependency('yt-dom-survey', 'yt-contract-tests'),
    dependency('yt-flow-audit', 'yt-contract-tests'),
    dependency('yt-home-search', 'yt-package-smoke'),
    dependency('yt-package-smoke', 'yt-terminal-audit'),
    dependency('yt-watch-retire', 'yt-package-smoke'),
  ],
  joins: [],
};

extraction.extraction_digest = todoSelfDigest(extraction, 'extraction_digest');
writeFileSync(
  '/Users/kite/Developer/nope/.lattice/youtube-home-extraction.json',
  `${canonicalizeTodoArtifact(extraction)}\n`,
);
console.log(`written tasks=${tasks.length} deps=${extraction.hard_dependencies.length}`);
