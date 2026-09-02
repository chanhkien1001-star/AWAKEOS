/**
 * Assembles the platform ports into `AwakeRuntimeDeps`. Reference wiring —
 * compiled inside a React Native project, not by this repo.
 */

import { NativeEventEmitter, NativeModules } from 'react-native';
import { MMKV } from 'react-native-mmkv';
import * as Keychain from 'react-native-keychain';
import QuickCrypto from 'react-native-quick-crypto';

import { createEventCollector, cryptoIdFactory, systemClock } from '@awake-os/core';
import {
  createAesGcmEncryption,
  createAwarenessWindowChoiceProvider,
  createMmkvStorageBackend,
  createNativeEventSource,
  type AwakeRuntimeDeps,
  type AwarenessWindowPresenter,
} from '@awake-os/app';

const KEYCHAIN_SERVICE = 'os.awake.storage-key.v1';

async function getOrCreateStorageKey(): Promise<Uint8Array> {
  const existing = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
  if (existing) return Uint8Array.from(Buffer.from(existing.password, 'base64'));

  const fresh = QuickCrypto.getRandomValues(new Uint8Array(32));
  await Keychain.setGenericPassword('key', Buffer.from(fresh).toString('base64'), {
    service: KEYCHAIN_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return fresh;
}

/** `presenter` is the mounted `<AwarenessWindowHost>` exposed via its ref. */
export async function buildRuntimeDeps(presenter: AwarenessWindowPresenter): Promise<AwakeRuntimeDeps> {
  const clock = systemClock;
  const ids = cryptoIdFactory;

  const collector = createEventCollector({ ids, clock });
  const native = NativeModules.AwakeEventCollector;
  const emitter = new NativeEventEmitter(native);
  const eventSource = createNativeEventSource({ native, emitter, collector });
  await eventSource.start();

  const storageBackend = createMmkvStorageBackend(new MMKV({ id: 'awake-os' }));
  const encryption = await createAesGcmEncryption({
    subtle: QuickCrypto.subtle as never,
    random: { getRandomValues: (a) => QuickCrypto.getRandomValues(a) },
    keyBytes: await getOrCreateStorageKey(),
  });

  const choiceProvider = createAwarenessWindowChoiceProvider({ ids, clock, presenter });

  return { eventSource, choiceProvider, storageBackend, encryption, clock, ids };
}
