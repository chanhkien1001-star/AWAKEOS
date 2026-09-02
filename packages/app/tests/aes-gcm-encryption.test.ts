import test from 'node:test';
import assert from 'node:assert/strict';

import { createAesGcmEncryption, type SubtleCryptoLike, type RandomSource } from '../src/storage/aes-gcm-encryption.ts';

const subtle = globalThis.crypto.subtle as unknown as SubtleCryptoLike;
const random: RandomSource = { getRandomValues: (a) => globalThis.crypto.getRandomValues(a) as Uint8Array };
const key = new Uint8Array(32).fill(7);

test('round-trips plaintext through AES-256-GCM', async () => {
  const enc = await createAesGcmEncryption({ subtle, random, keyBytes: key });
  const plain = new TextEncoder().encode('{"type":"ScreenStateChanged","payload":{"state":"Unlocked"}}');
  const cipher = await enc.encrypt(plain);
  const back = await enc.decrypt(cipher);
  assert.deepEqual(Array.from(back), Array.from(plain));
});

test('ciphertext does not contain the plaintext and carries a 12-byte IV prefix', async () => {
  const enc = await createAesGcmEncryption({ subtle, random, keyBytes: key });
  const plain = new TextEncoder().encode('Unlocked-secret-marker');
  const cipher = await enc.encrypt(plain);
  assert.ok(cipher.length >= 12 + plain.length);
  assert.ok(!new TextDecoder().decode(cipher).includes('Unlocked-secret-marker'));
});

test('each encryption uses a fresh IV (distinct ciphertext for the same input)', async () => {
  const enc = await createAesGcmEncryption({ subtle, random, keyBytes: key });
  const plain = new TextEncoder().encode('same input');
  const a = await enc.encrypt(plain);
  const b = await enc.encrypt(plain);
  assert.notDeepEqual(Array.from(a), Array.from(b));
});

test('a wrong-length key is rejected', async () => {
  await assert.rejects(() => createAesGcmEncryption({ subtle, random, keyBytes: new Uint8Array(16) }));
});
