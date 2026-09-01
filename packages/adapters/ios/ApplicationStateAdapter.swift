import CryptoKit
import Foundation

/// STEP 1 SKELETON — iOS foreground-application Event collector.
///
/// On iOS a general app cannot see *other* apps' foreground state without a
/// screen-time entitlement (DeviceActivity / FamilyControls). Where that is
/// granted, `DeviceActivityMonitor` callbacks feed this adapter; otherwise it
/// only reports transitions of the host app itself.
///
/// Invariants:
///  - I-02: emits only the observed foreground/background transition.
///  - I-09: bundle id is salted-hashed here; buffer drained locally, no network.
final class ApplicationStateAdapter {
    private var pending: [NormalizedEvent] = []
    private let installSalt: Data
    private let clockMs: () -> Int64
    private let newUuid: () -> String

    init(
        installSalt: Data,
        clockMs: @escaping () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1000) },
        newUuid: @escaping () -> String = { UUID().uuidString }
    ) {
        self.installSalt = installSalt
        self.clockMs = clockMs
        self.newUuid = newUuid
    }

    /// `state` is one of: "Foreground", "Background", "Terminated".
    func onApplicationTransition(bundleId: String, state: String, timestampMs: Int64?) {
        guard ["Foreground", "Background", "Terminated"].contains(state) else { return }
        let hash = hashBundleId(bundleId)
        pending.append(
            NormalizedEvent(
                id: newUuid(),
                occurredAt: timestampMs ?? clockMs(),
                type: "ApplicationStateChanged",
                sourceType: "System",
                sourceId: "ios.app-lifecycle",
                subjectType: "Application",
                subjectId: hash,
                payload: ["state": state, "packageNameHash": hash],
                schemaVersion: "1.0.0"
            )
        )
    }

    func drainPendingEvents() -> [NormalizedEvent] {
        let out = pending
        pending.removeAll(keepingCapacity: true)
        return out
    }

    private func hashBundleId(_ bundleId: String) -> String {
        var hasher = SHA256()
        hasher.update(data: installSalt)
        hasher.update(data: Data(bundleId.utf8))
        let digest = hasher.finalize()
        let b64 = Data(digest).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        return "sha256:\(b64)"
    }
}
