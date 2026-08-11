# EC3サイト 登録UI契約・失敗テスト（crui-contract-tests）

検証日: 2026-08-12 / 担当: bell

## 背景

楽天市場・Yahoo!ショッピング・Amazonは、adapterが発信元IDを解決して保存済みブロックを適用できる一方、`resolver.register`が無いため利用者の登録ボタンは生成されなかった。旧smokeはstorageへ値を直接投入したため、この欠陥を検出できなかった。

## 追加した契約

- 楽天市場・Yahoo!ショッピングは`entityLabel: ショップ`を持つ
- Amazonは`entityLabel: 出品者`を持つ
- YouTubeは`entityLabel: チャンネル`を明示し、既存文言を維持する
- DOM解決型adapterの登録ボタンclickが、押したカードの`sourceId`と`sourceName`だけを保存し、即時placeholder表示と解除復元まで到達する
- Amazonの`resolveSource()`が`null`を返す販売者不在カードには登録ボタンを出さない

## 実装前の失敗確認

```
node --test test/content-search.test.mjs \
  test/adapters/rakuten.test.mjs \
  test/adapters/yahoo_shopping.test.mjs \
  test/adapters/amazon.test.mjs \
  test/adapters/youtube.test.mjs
```

結果: **84件中79 pass / 5 fail**。

失敗した5契約:

1. Amazonの出品者登録設定が無い
2. 楽天市場のショップ登録設定が無い
3. Yahoo!ショッピングのショップ登録設定が無い
4. YouTubeがチャンネル種別を明示していない
5. 共通エンジンがadapterの`entityLabel`を使わず「このチャンネルをブロック」と固定表示する

Amazon販売者不在カードへボタンを出さない負契約は、実装前からgreenであり現行のfail closedを固定した。

## 境界

このtaskでは製品コードを変更していない。次task `crui-implementation` が上記5件をgreenにする。
