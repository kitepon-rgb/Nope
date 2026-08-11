import { writeFileSync } from 'node:fs';
import {
  canonicalizeTodoArtifact,
  todoSelfDigest,
} from 'file:///Users/kite/Developer/Lattice/src/todo-contracts.mjs';

const COMMIT = '97f66ecb00e8e2e2bf3db6bc626035be0ca6085d';
const ORIGIN = 'docs/plan_commerce-register-ui.md';
const PROJECT = 'ChromeBlocker';
const PLAN = 'nope-commerce-register-ui';

const source = (line, heading) => ({
  origin_plan_ref: ORIGIN,
  origin_line: line,
  source_commit: COMMIT,
  heading_path: [
    'EC検索面の発信元登録UI補完（plan: nope-commerce-register-ui）',
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

const tasks = [
  task({
    id: 'crui-contract-tests',
    title: 'EC3サイトの登録UI契約と失敗テスト',
    lane: 'test',
    line: 19,
    heading: 'crui-contract-tests — 登録UI契約と失敗テスト',
    memo: `## 目的
旧smokeがstorage直投入だけで登録入口欠落を見逃したため、利用者のclick導線を実装前に赤いテストで固定する。

## 必須契約
- 楽天市場・Yahoo!ショッピングは「このショップをブロック」、Amazonは「この出品者をブロック」
- adapterが解決したsourceId/sourceNameをclickでaddBlockedSourceへ渡す
- click直後の同一発信元ブロック、placeholder解除、popup削除後の再適用契約を既存storage購読と接続する
- AmazonのresolveSourceがnullのカードには登録ボタンを出さない
- YouTubeは「このチャンネルをブロック」のまま

## 境界
このtaskでは製品コードを変更しない。fixtureは既存の実DOM証跡から縮約し、storageへ完成値を直接入れるだけのテストを受入根拠にしない。`,
    migrationContext: context([
      '旧v7/v8 smokeはstorage seedで非表示だけを検証し、登録入口欠落を見逃した',
      '安全網を製品変更より先に置く',
    ], { carryOver: 'nope-v2:v7a-verify-id,v8b-package-smoke' }),
  }),
  task({
    id: 'crui-implementation',
    title: '共通エンジンとEC3adapterの登録UI実装',
    lane: 'impl',
    line: 23,
    heading: 'crui-implementation — 共通エンジンと3adapterの登録UI実装',
    memo: `## 目的
楽天市場・Yahoo!ショッピング・Amazonの検索カードから、解決済みのショップ／出品者を利用者が登録できるようにする。

## 変更
- content-search.jsの登録UIへadapter指定のentityLabelを通し、ボタン文言と識別子解決失敗文言をサイト固有化する
- rakuten/yahoo_shoppingへショップ登録設定、amazonへ出品者登録設定を追加する
- YouTubeのfloating UIと既存のチャンネル文言を維持する
- Amazon seller不在のnullを架空IDへ変換しない

## 受入
crui-contract-testsをgreenにし、関連adapterテストと既存YouTubeテストを通す。共通エンジンの変更は7サイト全体の回帰を確認する。`,
    migrationContext: context([
      '3adapterはresolver.register未定義のため共通エンジンが登録UIを生成していない',
      '共通文言がチャンネル固定なのでadapter有効化だけでは誤表示になる',
    ]),
  }),
  task({
    id: 'crui-package-smoke',
    title: 'EC3サイト登録UIの再梱包と実Chrome受入',
    lane: 'release',
    line: 27,
    heading: 'crui-package-smoke — 再梱包とオーナー実Chrome受入',
    memo: `## 自動検証
関連テスト後に全テストを1回実行し、scripts/pack.mjsでZIPとstable unpackedを再生成する。src/とunpackedの一致、必要資産、manifestを確認する。

## オーナー実Chrome受入（H）
楽天市場、Yahoo!ショッピング、Amazonを1サイトずつ確認する。各サイトでボタン表示、押したカードとpopup登録名の一致、即時ブロック、解除復元を確認する。Amazonは販売者が存在するマーケットプレイス商品を使い、Amazon直販カードにボタンが無いことも確認する。

## 証跡
docs/evidence/commerce-register-ui-smoke.mdへテスト件数、ZIP SHA-256、配布物一致、オーナー結果を記録する。H未実施を完了扱いしない。`,
    migrationContext: context([
      '通常Chromeの実DOMでボタン位置とサイト再描画後の存続を確認する',
      'Amazonはseller解決済みカードとseller不在カードを分ける',
    ], {
      hRequired: true,
      condition: 'オーナー通常Chromeで楽天市場・Yahoo!ショッピング・Amazonの登録、対象一致、ブロック、解除が合格すること',
    }),
  }),
  task({
    id: 'crui-terminal-audit',
    title: 'EC3サイト登録UIの終端監査',
    lane: 'audit',
    line: 31,
    heading: 'crui-terminal-audit — 別席による終端監査',
    memo: `## 目的
実装席とは別の円卓席が、コード・テスト・配布物・H証跡を反証する。

## 必須反証
- 3adapterすべてにUI登録入口があり、storage直投入だけの偽受入でない
- 押したカードのsourceId/sourceNameとpopup登録対象が一致する
- ショップ／出品者／チャンネルの文言が混線していない
- Amazon seller不在を架空の発信元として登録しない
- 配布物が最新srcと一致し、H受入が実施済み

## 報告
円卓へ受理または具体的異議を投稿し、docs/evidence/commerce-register-ui-terminal-audit.mdへ根拠を残す。`,
    migrationContext: context([
      '実装担当と別席が終端監査する',
      '旧工程のstorage seedによる偽受入を重点反証する',
    ]),
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
    dependency('crui-contract-tests', 'crui-implementation'),
    dependency('crui-implementation', 'crui-package-smoke'),
    dependency('crui-package-smoke', 'crui-terminal-audit'),
  ],
  joins: [],
};

extraction.extraction_digest = todoSelfDigest(extraction, 'extraction_digest');

writeFileSync(
  '.lattice/commerce-register-ui-extraction.json',
  `${canonicalizeTodoArtifact(extraction)}\n`,
);
