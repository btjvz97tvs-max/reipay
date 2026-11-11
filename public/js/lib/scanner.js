// カメラでQRコードとバーコードを読み取る。
// 対応しているブラウザ（Android の Chrome など）は標準の BarcodeDetector を使い、
// iPhone の Safari など対応していない場合は jsQR（QR）と自作の ITF 読み取り（バーコード）を使う。

import { isValidPaymentCode, PAYMENT_CODE_LENGTH } from '../shared/payment-code.js';
import { decodeItfImage } from './itf.js';
import { loadScript } from './load-script.js';

const JSQR_URL = '/vendor/jsqr/jsQR.js';
const SCAN_INTERVAL_MS = 200;
const FRAME_MAX_WIDTH = 960;
const WANTED_FORMATS = ['qr_code', 'itf'];

async function createNativeDetector() {
  if (!('BarcodeDetector' in window)) {
    return null;
  }
  try {
    const supported = await window.BarcodeDetector.getSupportedFormats();
    const formats = WANTED_FORMATS.filter((format) => supported.includes(format));
    if (formats.length === 0) {
      return null;
    }
    return { detector: new window.BarcodeDetector({ formats }), formats };
  } catch {
    return null;
  }
}

function captureFrame(video, canvas, context) {
  const scale = Math.min(1, FRAME_MAX_WIDTH / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

async function createDetector() {
  const native = await createNativeDetector();
  const needsJsQr = !native?.formats.includes('qr_code');
  const needsItf = !native?.formats.includes('itf');
  if (needsJsQr) {
    await loadScript(JSQR_URL);
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });

  return async (video) => {
    const texts = [];
    if (native) {
      const barcodes = await native.detector.detect(video);
      texts.push(...barcodes.map((barcode) => barcode.rawValue));
    }
    if (needsJsQr || needsItf) {
      const imageData = captureFrame(video, canvas, context);
      if (needsJsQr) {
        const result = window.jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });
        if (result) {
          texts.push(result.data);
        }
      }
      if (needsItf) {
        const digits = decodeItfImage(imageData, {
          digitCount: PAYMENT_CODE_LENGTH,
          isValid: isValidPaymentCode,
        });
        if (digits) {
          texts.push(digits);
        }
      }
    }
    return texts;
  };
}

// 読み取りを始め、止めるための関数を返す。onDetected が true を返したら読み取りを終える。
export async function startScanner({ video, onDetected }) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
  });

  let isStopped = false;
  let timerId = null;
  const stop = () => {
    isStopped = true;
    window.clearTimeout(timerId);
    for (const track of stream.getTracks()) {
      track.stop();
    }
    video.srcObject = null;
  };

  try {
    video.srcObject = stream;
    await video.play();
    const detect = await createDetector();

    const scanFrame = async () => {
      if (isStopped) {
        return;
      }
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
        const texts = await detect(video);
        if (!isStopped && texts.some((text) => onDetected(text))) {
          stop();
          return;
        }
      }
      timerId = window.setTimeout(scanFrame, SCAN_INTERVAL_MS);
    };
    scanFrame();
  } catch (error) {
    stop();
    throw error;
  }
  return stop;
}
