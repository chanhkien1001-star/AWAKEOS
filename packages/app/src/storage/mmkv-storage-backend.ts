/**
 * `StorageBackend` over an MMKV-shaped key-value store.
 *
 * Each log is one MMKV key holding a JSON array of `number[]` records (the raw
 * ciphertext bytes). No base64, no `Buffer` — portable across Hermes without a
 * polyfill. A production build with heavy history should move to SQLite and push
 * the time-range predicate down; for the scaffold this is simple and correct.
 *
 * On device, pass a `react-native-mmkv` instance; it stores to the app sandbox
 * only (I-09). This module never touches the network.
 */

import type { StorageBackend } from '@awake-os/core';

/** The slice of `react-native-mmkv`'s API this backend needs. */
export interface MmkvLike {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
}

const keyFor = (log: string) => `awake:store:${log}`;

export function createMmkvStorageBackend(mmkv: MmkvLike): StorageBackend {
  const read = (log: string): number[][] => {
    const raw = mmkv.getString(keyFor(log));
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as number[][]) : [];
    } catch {
      return [];
    }
  };
  const write = (log: string, records: number[][]) => mmkv.set(keyFor(log), JSON.stringify(records));

  return {
    async append(log, record) {
      const records = read(log);
      records.push(Array.from(record));
      write(log, records);
    },
    async readAll(log) {
      return read(log).map((r) => Uint8Array.from(r));
    },
    async rewrite(log, records) {
      write(log, records.map((r) => Array.from(r)));
    },
  };
}
