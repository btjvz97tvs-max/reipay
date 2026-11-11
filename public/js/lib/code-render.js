// バーコードとQRコードを SVG で描く。色は CSS（.barcode__bar / .qr-code__modules）で決める。

import qrcode from '../../vendor/qrcode-generator/qrcode.esm.js';
import { encodeItf, QUIET_ZONE_UNITS } from './itf.js';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const BARCODE_HEIGHT_UNITS = 60;
const QR_QUIET_ZONE_MODULES = 4;

function createSvgElement(name, attributes) {
  const element = document.createElementNS(SVG_NAMESPACE, name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }
  return element;
}

export function createBarcodeSvg(digits, label) {
  const widths = encodeItf(digits);
  const totalUnits = widths.reduce((total, width) => total + width, 0) + QUIET_ZONE_UNITS * 2;
  const svg = createSvgElement('svg', {
    class: 'barcode',
    viewBox: `0 0 ${totalUnits} ${BARCODE_HEIGHT_UNITS}`,
    preserveAspectRatio: 'none',
    'shape-rendering': 'crispEdges',
    role: 'img',
    'aria-label': label,
  });

  let x = QUIET_ZONE_UNITS;
  widths.forEach((width, index) => {
    if (index % 2 === 0) {
      svg.append(
        createSvgElement('rect', {
          class: 'barcode__bar',
          x,
          y: 0,
          width,
          height: BARCODE_HEIGHT_UNITS,
        }),
      );
    }
    x += width;
  });
  return svg;
}

export function createQrCodeSvg(text, { mode = 'Byte', label }) {
  const qr = qrcode(0, 'M');
  qr.addData(text, mode);
  qr.make();

  const count = qr.getModuleCount();
  const size = count + QR_QUIET_ZONE_MODULES * 2;
  let path = '';
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (qr.isDark(row, column)) {
        path += `M${column + QR_QUIET_ZONE_MODULES} ${row + QR_QUIET_ZONE_MODULES}h1v1h-1z`;
      }
    }
  }

  const svg = createSvgElement('svg', {
    class: 'qr-code',
    viewBox: `0 0 ${size} ${size}`,
    'shape-rendering': 'crispEdges',
    role: 'img',
    'aria-label': label,
  });
  svg.append(createSvgElement('path', { class: 'qr-code__modules', d: path }));
  return svg;
}
