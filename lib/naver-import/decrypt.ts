import "server-only";
import { createDecipheriv, createHash } from "node:crypto";
import CFB from "cfb";

/*
 * 비밀번호가 걸린 엑셀(.xlsx) 풀기.
 * 네이버 스마트플레이스는 예약자 엑셀을 내려받을 때 비밀번호를 걸어요(Office "Agile" 암호화, AES-256 + SHA-512).
 * 표준(MS-OFFCRYPTO 2.3.4.10~15) 그대로 Node 내장 crypto로 풀어요. 비밀번호와 파일은 어디에도 남기지 않아요.
 */

export class WrongPasswordError extends Error {
  constructor() {
    super("비밀번호가 맞지 않아요.");
  }
}

const BLOCK_KEYS = {
  verifierInput: Buffer.from("fea7d2763b4b9e79", "hex"),
  verifierHash: Buffer.from("d7aa0f6d3061344e", "hex"),
  keyValue: Buffer.from("146e0be7abacd0d6", "hex"),
};
const SEGMENT = 4096;

/** 잠긴 파일인지(엑셀이 아닌 OLE 상자에 담겨 있는지) */
export function isEncryptedOffice(buf: Buffer) {
  return buf.subarray(0, 8).equals(Buffer.from("d0cf11e0a1b11ae1", "hex"));
}

type Params = {
  salt: Buffer;
  hash: string;
  hashSize: number;
  keyBits: number;
  blockSize: number;
  cipher: string;
};

function attrs(xml: string, tag: string): Record<string, string> {
  const m = xml.match(new RegExp(`<${tag}\\s([^>]*?)/?>`));
  if (!m) throw new Error(`암호 정보(${tag})를 못 찾았어요.`);
  return Object.fromEntries([...m[1].matchAll(/([\w:]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]));
}

function params(a: Record<string, string>): Params {
  if (a.cipherAlgorithm !== "AES" || a.cipherChaining !== "ChainingModeCBC") {
    throw new Error(`지원하지 않는 암호 방식이에요: ${a.cipherAlgorithm} ${a.cipherChaining}`);
  }
  const keyBits = Number(a.keyBits);
  return {
    salt: Buffer.from(a.saltValue, "base64"),
    hash: a.hashAlgorithm.toLowerCase().replace("-", ""),
    hashSize: Number(a.hashSize),
    keyBits,
    blockSize: Number(a.blockSize),
    cipher: `aes-${keyBits}-cbc`,
  };
}

const digest = (alg: string, ...parts: Buffer[]) => {
  const h = createHash(alg);
  for (const p of parts) h.update(p);
  return h.digest();
};

/** 길이를 맞춰요: 길면 자르고, 짧으면 0x36으로 채워요 */
function fit(buf: Buffer, size: number) {
  if (buf.length >= size) return buf.subarray(0, size);
  return Buffer.concat([buf, Buffer.alloc(size - buf.length, 0x36)]);
}

function aesDecrypt(cipher: string, key: Buffer, iv: Buffer, data: Buffer) {
  const d = createDecipheriv(cipher, key, iv);
  d.setAutoPadding(false);
  return Buffer.concat([d.update(data), d.final()]);
}

const u32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
};

export function decryptOfficeFile(file: Buffer, password: string): Buffer {
  const cfb = CFB.read(file, { type: "buffer" });
  const info = CFB.find(cfb, "EncryptionInfo")?.content;
  const pkg = CFB.find(cfb, "EncryptedPackage")?.content;
  if (!info || !pkg) throw new Error("잠긴 엑셀 파일이 아니에요.");

  const infoBuf = Buffer.from(info as Uint8Array);
  if (infoBuf.readUInt16LE(0) !== 4 || infoBuf.readUInt16LE(2) !== 4) {
    throw new Error("이 엑셀 암호 방식은 아직 못 열어요. 엑셀에서 암호를 지우고 저장해 주세요.");
  }
  const xml = infoBuf.subarray(8).toString("utf8");
  const keyData = params(attrs(xml, "keyData"));
  const encAttrs = attrs(xml, "p:encryptedKey");
  const enc = params(encAttrs);
  const spinCount = Number(encAttrs.spinCount);

  // 비밀번호 → 해시(spinCount번 되풀이)
  let h = digest(enc.hash, enc.salt, Buffer.from(password, "utf16le"));
  for (let i = 0; i < spinCount; i++) h = digest(enc.hash, u32(i), h);
  const keyFor = (block: Buffer) => fit(digest(enc.hash, h, block), enc.keyBits / 8);
  const ivFor = (b: Buffer) => fit(b, enc.blockSize);

  // 비밀번호 확인
  const verifierInput = aesDecrypt(
    enc.cipher,
    keyFor(BLOCK_KEYS.verifierInput),
    ivFor(enc.salt),
    Buffer.from(encAttrs.encryptedVerifierHashInput, "base64"),
  ).subarray(0, enc.salt.length);
  const verifierHash = aesDecrypt(
    enc.cipher,
    keyFor(BLOCK_KEYS.verifierHash),
    ivFor(enc.salt),
    Buffer.from(encAttrs.encryptedVerifierHashValue, "base64"),
  ).subarray(0, enc.hashSize);
  if (!digest(enc.hash, verifierInput).equals(verifierHash)) throw new WrongPasswordError();

  const secretKey = aesDecrypt(
    enc.cipher,
    keyFor(BLOCK_KEYS.keyValue),
    ivFor(enc.salt),
    Buffer.from(encAttrs.encryptedKeyValue, "base64"),
  ).subarray(0, keyData.keyBits / 8);

  // 본문: 앞 8바이트는 원래 크기, 나머지는 4096바이트씩 따로 잠겨 있어요.
  const pkgBuf = Buffer.from(pkg as Uint8Array);
  const size = Number(pkgBuf.readBigUInt64LE(0));
  const body = pkgBuf.subarray(8);
  const out: Buffer[] = [];
  for (let i = 0, off = 0; off < body.length; i++, off += SEGMENT) {
    let chunk = body.subarray(off, off + SEGMENT);
    const rem = chunk.length % keyData.blockSize;
    if (rem) chunk = Buffer.concat([chunk, Buffer.alloc(keyData.blockSize - rem)]);
    const iv = fit(digest(keyData.hash, keyData.salt, u32(i)), keyData.blockSize);
    out.push(aesDecrypt(keyData.cipher, secretKey, iv, chunk));
  }
  return Buffer.concat(out).subarray(0, size);
}
