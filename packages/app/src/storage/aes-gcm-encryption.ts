/**
 * `EncryptionPort` — AES-256-GCM at rest (I-09).
 *
 * `keyBytes` is 32 raw bytes the platform hands over from its keystore
 * (Android Keystore / iOS Keychain, `…ThisDeviceOnly`, never synced). The key
 * never leaves the device and is never written to the backend.
 *
 * Each `encrypt` output is `[12-byte random IV | ciphertext+tag]` so `decrypt`
 * is self-describing. Uses the standard WebCrypto SubtleCrypto surface — Node's
 * `globalThis.crypto` and `react-native-quick-crypto`'s webcrypto both satisfy it.
 */

import type { EncryptionPort } from '@awake-os/core';

export interface SubtleCryptoLike {
  importKey(
    format: 'raw',
    keyData: Uint8Array,
    algorithm: 'AES-GCM',
    extractable: boolean,
    keyUsages: readonly ('encrypt' | 'decrypt')[],
  ): Promise<unknown>;
  encrypt(algorithm: { name: 'AES-GCM'; iv: Uint8Array }, key: unknown, data: Uint8Array): Promise<ArrayBuffer>;
  decrypt(algorithm: { name: 'AES-GCM'; iv: Uint8Array }, key: unknown, data: Uint8Array): Promise<ArrayBuffer>;
}

export interface RandomSource {
  /** Fill `array` with cryptographically strong random bytes and return it. */
  getRandomValues(array: Uint8Array): Uint8Array;
}

const IV_BYTES = 12;

export async function createAesGcmEncryption(deps: {
  readonly subtle: SubtleCryptoLike;
  readonly random: RandomSource;
  /** Exactly 32 bytes. */
  readonly keyBytes: Uint8Array;
}): Promise<EncryptionPort> {
  if (deps.keyBytes.length !== 32) {
    throw new Error(`AES-256-GCM needs a 32-byte key, got ${deps.keyBytes.length}`);
  }
  const key = await deps.subtle.importKey('raw', deps.keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt']);

  return {
    async encrypt(plaintext) {
      const iv = deps.random.getRandomValues(new Uint8Array(IV_BYTES));
      const cipher = new Uint8Array(await deps.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));
      const out = new Uint8Array(IV_BYTES + cipher.length);
      out.set(iv, 0);
      out.set(cipher, IV_BYTES);
      return out;
    },
    async decrypt(ciphertext) {
      const iv = ciphertext.subarray(0, IV_BYTES);
      const body = ciphertext.subarray(IV_BYTES);
      return new Uint8Array(await deps.subtle.decrypt({ name: 'AES-GCM', iv }, key, body));
    },
  };
}
