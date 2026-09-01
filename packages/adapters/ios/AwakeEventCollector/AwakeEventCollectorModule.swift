import Foundation
import React

/// React Native bridge for the Human Agency OS Event Collector (Step 1).
///
/// JS surface (see packages/app/src/ingestion/native-module.ts):
///   start(options): Promise<{ permission }>
///   stop(): Promise<void>
///   drainPendingEvents(): Promise<RawNativeEvent[]>
///   getStatus(): Promise<NativeCollectorStatus>
///   openPermissionSettings(): Promise<void>
///
/// Push channel: emits "awake:rawEventBatch" (array of flat RawNativeEvent dicts).
///
/// Invariants: only observed OS transitions are forwarded (I-02); bundle ids are
/// salted-hashed before leaving this process; nothing is sent anywhere but the
/// local JS bridge (I-09).
@objc(AwakeEventCollector)
final class AwakeEventCollectorModule: RCTEventEmitter {

    private let buffer = RawEventBuffer()
    private lazy var hasher = BundleHasher()
    private var screenObserver: ScreenStateObserver?
    private var lifecycleObserver: AppLifecycleObserver?
    private var hasJSListeners = false
    private var running = false

    override static func requiresMainQueueSetup() -> Bool { true }
    override func supportedEvents() -> [String]! { ["awake:rawEventBatch"] }
    override func startObserving() { hasJSListeners = true }
    override func stopObserving() { hasJSListeners = false }

    private func handle(_ event: RawEvent) {
        buffer.add(event)
        if hasJSListeners {
            sendEvent(withName: "awake:rawEventBatch", body: [event.toDictionary()])
        }
    }

    @objc(start:resolver:rejecter:)
    func start(_ options: NSDictionary, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
        let observe = options["observe"] as? NSDictionary
        let wantScreen = (observe?["screenState"] as? Bool) ?? true
        let wantApp = (observe?["applicationState"] as? Bool) ?? true

        if wantScreen, screenObserver == nil {
            let obs = ScreenStateObserver { [weak self] in self?.handle($0) }
            obs.start()
            screenObserver = obs
        }
        if wantApp, lifecycleObserver == nil {
            let obs = AppLifecycleObserver(onEvent: { [weak self] in self?.handle($0) }, hasher: hasher)
            obs.start()
            lifecycleObserver = obs
        }
        running = true
        // "partial": host-app lifecycle only. A DeviceActivity extension upgrades
        // this to "granted" when the Family Controls entitlement is authorized.
        resolve(["permission": "partial"])
    }

    @objc(stop:rejecter:)
    func stop(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
        screenObserver?.stop(); screenObserver = nil
        lifecycleObserver?.stop(); lifecycleObserver = nil
        running = false
        resolve(nil)
    }

    @objc(drainPendingEvents:rejecter:)
    func drainPendingEvents(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
        resolve(buffer.drain().map { $0.toDictionary() })
    }

    @objc(getStatus:rejecter:)
    func getStatus(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
        resolve([
            "running": running,
            "permission": "partial",
            "pendingNative": buffer.size(),
            "adapterVersion": "ios-step1",
        ])
    }

    @objc(openPermissionSettings:rejecter:)
    func openPermissionSettings(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
        if let url = URL(string: UIApplication.openSettingsURLString) {
            DispatchQueue.main.async { UIApplication.shared.open(url) }
        }
        resolve(nil)
    }
}
