/**
 * Storage stubs for tests and dev.
 *
 *  - `createInMemoryStorageBackend` — a byte log that lives in the process.
 *  - `identityEncryption` — pass-through; use when a test is not about crypto.
 *  - `xorEncryption` — a real (weak) transform, so a test can prove the backend
 *    holds ciphertext, not plaintext, and that decrypt round-trips.
 *
 * A production build swaps these for MMKV / SQLite + AES-GCM (see
 * `@awake-os/app` storage adapters).
 */

import type { EncryptionPort, StorageBackend } from '../storage/ports.ts';

export function createInMemoryStorageBackend(): StorageBackend & {
  size(log: string): number;
  raw(log: string): readonly Uint8Array[];
} {
  const logs = new Map<string, Uint8Array[]>();
  const of = (log: string) => logs.get(log) ?? logs.set(log, []).get(log)!;
  return {
    async append(log, record) {
      of(log).push(record);
    },
    async readAll(log) {
      return [...of(log)];
    },
    async rewrite(log, records) {
      logs.set(log, [...records]);
    },
    size: (log) => logs.get(log)?.length ?? 0,
    raw: (log) => [...(logs.get(log) ?? [])],
  };
}

export const identityEncryption: EncryptionPort = {
  async encrypt(plaintext) {
    return plaintext;
  },
  async decrypt(ciphertext) {
    return ciphertext;
  },
};

export function xorEncryption(keyByte = 0x5a): EncryptionPort {
  const xor = (b: Uint8Array): Uint8Array => {
    const out = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) out[i] = b[i]! ^ keyByte;
    return out;
  };
  return {
    async encrypt(plaintext) {
      return xor(plaintext);
    },
    async decrypt(ciphertext) {
      return xor(ciphertext);
    },
  };
}
