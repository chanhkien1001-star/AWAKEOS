/**
 * STORAGE PORTS — the seam under the local-first store (I-09).
 *
 * `createPersistentLocalStore` implements the full `LocalStore` on top of these
 * two tiny ports. The React Native side provides real implementations:
 *  - `StorageBackend`  → MMKV / SQLite / app-sandbox files (on device only);
 *  - `EncryptionPort`  → AES-GCM with a key held in the platform keystore.
 *
 * Nothing here reaches the network. A sync feature, if it ever exists, is a
 * separate opt-in adapter layered above `LocalStore`, never inside it.
 */

/** An append-only byte log addressed by name. Records are opaque (already encrypted). */
export interface StorageBackend {
  append(log: string, record: Uint8Array): Promise<void>;
  /** Every record ever appended to `log`, in append order. */
  readAll(log: string): Promise<readonly Uint8Array[]>;
  /** Replace the whole log (used by retention pruning). */
  rewrite(log: string, records: readonly Uint8Array[]): Promise<void>;
}

/** At-rest encryption. `encrypt` output must be self-describing (e.g. IV-prefixed). */
export interface EncryptionPort {
  encrypt(plaintext: Uint8Array): Promise<Uint8Array>;
  decrypt(ciphertext: Uint8Array): Promise<Uint8Array>;
}
