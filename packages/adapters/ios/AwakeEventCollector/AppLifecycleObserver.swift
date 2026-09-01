import UIKit

/// Observes the HOST app's own foreground/background transitions and emits
/// `ApplicationStateChanged` RawEvents with a salted hash of the host bundle id.
///
/// A general iOS app cannot see *other* apps' foreground state. Cross-app
/// visibility needs the Family Controls / DeviceActivity entitlement — see
/// `DeviceActivityBridge.swift`, which feeds the same buffer when granted.
///
/// I-02: only the lifecycle transition + hashed identity are reported.
final class AppLifecycleObserver {

    private let onEvent: (RawEvent) -> Void
    private let hashedBundleId: String
    private var observers: [NSObjectProtocol] = []

    init(onEvent: @escaping (RawEvent) -> Void, hasher: BundleHasher) {
        self.onEvent = onEvent
        self.hashedBundleId = hasher.hash(Bundle.main.bundleIdentifier ?? "unknown.host")
    }

    func start() {
        let nc = NotificationCenter.default
        observers.append(nc.addObserver(
            forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            self.onEvent(.application("Foreground", self.hashedBundleId, nowMs()))
        })
        observers.append(nc.addObserver(
            forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            self.onEvent(.application("Background", self.hashedBundleId, nowMs()))
        })
        observers.append(nc.addObserver(
            forName: UIApplication.willTerminateNotification, object: nil, queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            self.onEvent(.application("Terminated", self.hashedBundleId, nowMs()))
        })
    }

    func stop() {
        observers.forEach { NotificationCenter.default.removeObserver($0) }
        observers.removeAll()
    }
}
