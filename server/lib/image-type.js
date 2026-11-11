// 画像ファイルの先頭のバイト列から、本当の種類を確かめる。
// 送られてきた「image/png」などの申告はうそでも書けるので、中身で判断する。

const SIGNATURES = [
  { contentType: 'image/jpeg', bytes: [0xff, 0xd8, 0xff], offset: 0 },
  { contentType: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], offset: 0 },
  // WebP は「RIFF」で始まり、8バイト目から「WEBP」が続く
  {
    contentType: 'image/webp',
    bytes: [0x52, 0x49, 0x46, 0x46],
    offset: 0,
    extra: [0x57, 0x45, 0x42, 0x50],
    extraOffset: 8,
  },
];

function startsWith(bytes, expected, offset) {
  return expected.every((byte, index) => bytes[offset + index] === byte);
}

export function detectImageType(bytes) {
  for (const signature of SIGNATURES) {
    const isMatch =
      startsWith(bytes, signature.bytes, signature.offset) &&
      (!signature.extra || startsWith(bytes, signature.extra, signature.extraOffset));
    if (isMatch) {
      return signature.contentType;
    }
  }
  return null;
}
