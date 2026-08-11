# EC3サイト 登録UI実装（crui-implementation）

検証日: 2026-08-12 / 担当: bell

## 実装

- 楽天市場・Yahoo!ショッピングへ「このショップをブロック」の登録契約を追加した。
- Amazonへ「この出品者をブロック」の登録契約を追加し、`async_resolve`で販売者を解決した後だけボタンを生成するよう共通エンジンを拡張した。
- Amazon直販など`resolveSource()`が`null`を返すカードにはボタンを生成しない。
- 非同期解決cacheへ発信元名も保存し、cache命中後も正しい名称で登録する。旧版のID-only cacheは一度再解決して名称付きcacheへ更新する。
- 登録ボタン・識別子解決失敗文言へadapterの`entityLabel`を通した。YouTubeは`チャンネル`を明示し、旧adapter契約の既定値も`チャンネル`のまま維持した。

## 楽天市場の実Chrome実測

クオ君のChromeで開いていた検索ページ（検索語「メモリ」）をread-onlyで測定した。

- `.dui-card`: 50件
- 通常カードとCPC広告カードの双方に`data-shop-id`が存在した。
- 同一ショップ「スマホメモリ専門スターフォーカス」は、CPC・通常カードとも`data-shop-id="299852"`だった。
- CPC広告のショップリンクは`grp07.ias.rakuten.co.jp/redirect_rpp/`、通常カードは`www.rakuten.co.jp/{slug}/`だった。
- 店舗表示名は双方とも`.content.merchant`で取得できた。

このため、従来のショップslugではなく`data-shop-id`を楽天の正本IDにした。これにより先頭のCPC広告と通常カードを同じショップとしてブロックできる。

## 自動検証

```
node --test test/content-search.test.mjs \
  test/storage.test.mjs \
  test/adapters/*.test.mjs \
  test/youtube-surfaces.test.mjs
```

結果: **173件中173 pass**。

追加で固定した契約:

- Amazon販売者解決後のボタン生成、正しいID・名称の保存、即時placeholder化
- Amazon名称付きcache命中時は再通信しない
- Amazon旧ID-only cacheは名称付きcacheへ更新する
- Amazon販売者不在`null`ではボタンを出さない
- 楽天CPC・通常カードは共通の`data-shop-id`を使う
- 共通エンジン変更後もYouTubeのfloating button契約を維持する

`git diff --check`: green。

## 円卓

- room [180]: mashiroが、3 adapterの`resolver.register`欠落とAmazon非同期経路の未配線をread-only調査で特定した。
- room [181]-[184]: 最新差分を対象にread-only監査を依頼した。
- room [185]: mashiroが最新差分を再監査し、確定欠陥0件。全test `225/225` green、`git diff --check` cleanを報告した。
