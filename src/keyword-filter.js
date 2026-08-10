// キーワードマッチングモジュール。
// 一致規則（v4-adapter-name 確定 2026-08-11）:
//   部分一致 / 大文字小文字を区別しない / NFKC 正規化（全角半角を統一） / 複数キーワードは OR
// storage には生文字列を保存し、マッチング時に双方を正規化して比較する。
// CB_STORAGE・CB_SEARCH と同じく <script> 連結読み込み前提のグローバル公開。

'use strict';

const CB_KEYWORD_FILTER = (() => {
  /** @param {string} str @returns {string} */
  function normalize(str) {
    return str.normalize('NFKC').toLowerCase();
  }

  /**
   * キーワードリストのいずれかがテキストに部分一致するか判定する（OR 条件）。
   * @param {string} text
   * @param {string[]} keywords
   * @returns {boolean}
   */
  function matchesAny(text, keywords) {
    if (!keywords || keywords.length === 0) return false;
    const normalizedText = normalize(text);
    return keywords.some((kw) => normalizedText.includes(normalize(kw)));
  }

  return { normalize, matchesAny };
})();
