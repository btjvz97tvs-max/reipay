// パスキーの登録データ（CBOR 形式）を読むための、必要最小限の CBOR デコーダー。
// 対応: 整数、バイト列、文字列、配列、マップ、true/false/null

const MAJOR_UNSIGNED = 0;
const MAJOR_NEGATIVE = 1;
const MAJOR_BYTES = 2;
const MAJOR_TEXT = 3;
const MAJOR_ARRAY = 4;
const MAJOR_MAP = 5;
const MAJOR_SIMPLE = 7;

const SIMPLE_FALSE = 20;
const SIMPLE_TRUE = 21;
const SIMPLE_NULL = 22;

class CborReader {
  constructor(bytes) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.offset = 0;
  }

  readLength(additional) {
    if (additional < 24) {
      return additional;
    }
    if (additional === 24) {
      const value = this.view.getUint8(this.offset);
      this.offset += 1;
      return value;
    }
    if (additional === 25) {
      const value = this.view.getUint16(this.offset);
      this.offset += 2;
      return value;
    }
    if (additional === 26) {
      const value = this.view.getUint32(this.offset);
      this.offset += 4;
      return value;
    }
    if (additional === 27) {
      const high = this.view.getUint32(this.offset);
      const low = this.view.getUint32(this.offset + 4);
      this.offset += 8;
      return high * 2 ** 32 + low;
    }
    throw new Error('CBOR: この長さの形式には対応していません');
  }

  readBytes(length) {
    if (this.offset + length > this.bytes.length) {
      throw new Error('CBOR: データが途中で切れています');
    }
    const value = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  readItem() {
    const initial = this.view.getUint8(this.offset);
    this.offset += 1;
    const majorType = initial >> 5;
    const additional = initial & 0x1f;

    switch (majorType) {
      case MAJOR_UNSIGNED:
        return this.readLength(additional);
      case MAJOR_NEGATIVE:
        return -1 - this.readLength(additional);
      case MAJOR_BYTES:
        return this.readBytes(this.readLength(additional));
      case MAJOR_TEXT:
        return new TextDecoder().decode(this.readBytes(this.readLength(additional)));
      case MAJOR_ARRAY: {
        const length = this.readLength(additional);
        return Array.from({ length }, () => this.readItem());
      }
      case MAJOR_MAP: {
        const length = this.readLength(additional);
        const map = new Map();
        for (let index = 0; index < length; index += 1) {
          const key = this.readItem();
          map.set(key, this.readItem());
        }
        return map;
      }
      case MAJOR_SIMPLE:
        if (additional === SIMPLE_FALSE) {
          return false;
        }
        if (additional === SIMPLE_TRUE) {
          return true;
        }
        if (additional === SIMPLE_NULL) {
          return null;
        }
        throw new Error('CBOR: この値の形式には対応していません');
      default:
        throw new Error('CBOR: この形式には対応していません');
    }
  }
}

// 先頭の1項目を読み、その値と使ったバイト数を返す。
export function decodeFirstCborItem(bytes) {
  const reader = new CborReader(bytes);
  const value = reader.readItem();
  return { value, byteLength: reader.offset };
}

export function decodeCbor(bytes) {
  return decodeFirstCborItem(bytes).value;
}
