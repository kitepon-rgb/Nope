// mtop 署名（sign = md5(`${token}&${t}&${appKey}&${data}`)）専用の MD5 実装。
// MV3 content script はビルド工程なしで読み込むため外部依存を持てず、
// SubtleCrypto は MD5 を提供しない（SHA 系のみ）。よって自前実装する。
// 署名用途であり、セキュリティ目的のハッシュではない。

'use strict';

const CB_MD5 = (() => {
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  // K[i] = floor(abs(sin(i + 1)) * 2^32)
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i += 1) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x1_0000_0000);

  const rotateLeft = (value, shift) => (value << shift) | (value >>> (32 - shift));

  function toUtf8Bytes(text) {
    return new TextEncoder().encode(text);
  }

  /** @param {Uint8Array} bytes @returns {string} 32桁小文字hex */
  function md5Bytes(bytes) {
    const bitLength = bytes.length * 8;
    // 末尾に 0x80、長さ(64bit LE)を置いて 64byte 境界へ揃える。
    const paddedLength = (((bytes.length + 8) >> 6) + 1) << 6;
    const padded = new Uint8Array(paddedLength);
    padded.set(bytes);
    padded[bytes.length] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(paddedLength - 8, bitLength >>> 0, true);
    view.setUint32(paddedLength - 4, Math.floor(bitLength / 0x1_0000_0000), true);

    let a0 = 0x67452301;
    let b0 = 0xefcdab89;
    let c0 = 0x98badcfe;
    let d0 = 0x10325476;

    const block = new Uint32Array(16);
    for (let offset = 0; offset < paddedLength; offset += 64) {
      for (let i = 0; i < 16; i += 1) block[i] = view.getUint32(offset + i * 4, true);
      let [a, b, c, d] = [a0, b0, c0, d0];
      for (let i = 0; i < 64; i += 1) {
        let f;
        let g;
        if (i < 16) { f = (b & c) | (~b & d); g = i; }
        else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
        else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
        else { f = c ^ (b | ~d); g = (7 * i) % 16; }
        f = (f + a + K[i] + block[g]) | 0;
        a = d; d = c; c = b;
        b = (b + rotateLeft(f, S[i])) | 0;
      }
      a0 = (a0 + a) | 0; b0 = (b0 + b) | 0; c0 = (c0 + c) | 0; d0 = (d0 + d) | 0;
    }

    const digest = new Uint8Array(16);
    const digestView = new DataView(digest.buffer);
    digestView.setUint32(0, a0 >>> 0, true);
    digestView.setUint32(4, b0 >>> 0, true);
    digestView.setUint32(8, c0 >>> 0, true);
    digestView.setUint32(12, d0 >>> 0, true);
    return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  /** @param {string} text @returns {string} 32桁小文字hex */
  function md5(text) {
    return md5Bytes(toUtf8Bytes(text));
  }

  return { md5, md5Bytes };
})();
