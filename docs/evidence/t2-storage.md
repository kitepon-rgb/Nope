# t2-storage 完了証拠（2026-08-10）

## 実施

- src/storage.js（前セッション作成分）を設計メモと突合し、契約一致を確認:
  - `chrome.storage.sync.blockedStores = { [storeId]: { name, addedAt(epoch ms) } }`
  - `chrome.storage.local.productStoreCache = { [productId]: storeId }`
  - API: getBlockedStores / addBlockedStore / removeBlockedStore / getCachedStore / setCachedStore
  - キャッシュ上限 5000、超過時は挿入順の古いものから削除
  - onBlockedStoresChanged（sync 変更購読ヘルパ・解除関数返却）
- 設計メモ外の追加は clearCache のみ（popup のキャッシュ掃除用。範囲内の最小追加と判断）。

## 検証

- test/storage.test.mjs（chrome.storage を vm + 最小 mock で代替）4/4 green:
  1. blocklist の追加・削除と保存形
  2. 数値でない storeId の拒否
  3. 上限 5000 超過時の挿入順 eviction（5001 件投入で p0 が消え p5000 が残る）
  4. onChanged 購読の発火と解除
- 実 Chrome 上の storage.sync 動作は t7 実機 E2E で確認（ここでは mock 検証のみ＝実機未検証と明示）。
