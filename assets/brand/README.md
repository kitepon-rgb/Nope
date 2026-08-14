# Nope brand assets

このフォルダの画像は、Nopeの猫マスコットを製品identity、`kitepon.dev`を従属endorsementとして扱う公開用assetである。Nope identityをmaster logoで置き換えたり、両者を新しい一体logoとして再組版してはならない。

## 正本と再生成

- mascot input: `../mascot-source.png`（2048×2048）
- wordmark input: RootSitePromotion `artifacts/phase3-logo-raster/kitepon-dev-primary.png`（1200×360、縮小のみ）
- mascot output: `../mascot-blocked.png` / `../mascot-blocked-hover.png`（240×240）
- GitHub hero / social preview: `nope-github-hero.png` / `nope-social-preview.png`（1280×640）

2026-08-15時点の入力SHA-256:

```text
mascot-source.png: 7b697cd76c9e48d902a10492dfd327f40ee715a5854f641b029cf29af794ad39
kitepon-dev-primary.png: 3e66e774b26a6826698b05a2c412541b43d59ec2a13e51be2c5a08deb198188a
```

2026-08-15時点の出力SHA-256:

```text
mascot-blocked.png / mascot-blocked-hover.png: 9ddd4d5311c4a2ed6e2de1ab5d9ffb1ea9a13503d93df9057985d8468d77c727
nope-github-hero.png / nope-social-preview.png: f32d4c44827304be9c86fb38c5b2086acd5a0ea849059b5da8f15249b9ecec89
```

各画像は既存のpixel assetを縮小・配置しただけで、生成AIによるUIや利用結果の創作は含まない。GitHub SettingsへのSocial preview uploadはH操作であり、このrepository内の画像作成とは別に扱う。
