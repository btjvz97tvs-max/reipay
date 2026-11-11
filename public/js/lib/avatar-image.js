// 選んだ写真を、アイコン用の小さな正方形（JPEG）にする。
// サーバーに送るデータを小さくするため、画面側で切り抜きと縮小をしてから送る。

const AVATAR_SIZE = 256;
const JPEG_QUALITY = 0.85;
// 透明な部分がある画像（PNG など）も、JPEG にしたとき黒くならないよう白で塗っておく。
const BACKGROUND_COLOR = '#ffffff';

async function loadImage(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      // 対応していない形式のときは、下の img 要素で読み直す。
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// 真ん中を正方形に切り抜いて縮小し、「data:image/jpeg;base64,...」の文字列で返す。
export async function createAvatarDataUrl(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('画像ファイルを選んでください');
  }

  let image;
  try {
    image = await loadImage(file);
  } catch {
    throw new Error('この画像は読み込めませんでした。別の写真を選んでください');
  }

  const side = Math.min(image.width, image.height);
  const sourceX = (image.width - side) / 2;
  const sourceY = (image.height - side) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const context = canvas.getContext('2d');
  context.fillStyle = BACKGROUND_COLOR;
  context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  context.drawImage(image, sourceX, sourceY, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  image.close?.();

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}
