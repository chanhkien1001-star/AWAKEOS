import Foundation

/// STEP 1 SKELETON — iOS screen-state Event collector.
///
/// Observes `UIApplication.protectedDataWillBecomeUnavailable` (lock),
/// `protectedDataDidBecomeAvailable` (unlock), and screen brightness / display
/// notifications, emitting `ScreenStateChanged` Events (schema 1.0.0).
///
/// Invariants:
///  - I-02: only the observed transition is emitted.
///  - I-09: events buffer locally and are drained by the JS bridge. No network.
final class ScreenStateAdapter {
    private var pending: [NormalizedEvent] = []
    private let clockMs: () -> Int64
    private let newUuid: () -> String

    init(
        clockMs: @escaping () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1000) },
        newUuid: @escaping () -> String = { UUID().uuidString }
    ) {
        self.clockMs = clockMs
        self.newUuid = newUuid
    }

    /// `signal` is one of: "On", "Off", "Unlocked", "Locked".
    func onScreenSignal(_ signal: String) {
        guard ["On", "Off", "Unlocked", "Locked"].contains(signal) else { return }
        pending.append(
            NormalizedEvent(
                id: newUuid(),
                occurredAt: clockMs(),
                type: "ScreenStateChanged",
                sourceType: "System",
                sourceId: "ios.screen",
                subjectType: "Screen",
                subjectId: nil,
                payload: ["state": signal],
                schemaVersion: "1.0.0"
            )
        )
    }

    /// Bridge entry point consumed by NativeEventSource.pull().
    func drainPendingEvents() -> [NormalizedEvent] {
        let out = pending
        pending.removeAll(keepingCapacity: true)
        return out
    }
}

/// Minimal mirror of @awake-os/core Event; serialized to JSON across the bridge.
struct NormalizedEvent: Codable {
    let id: String
    let occurredAt: Int64
    let type: String
    let sourceType: String
    let sourceId: String
    let subjectType: String
    let subjectId: String?
    let payload: [String: String]
    let schemaVersion: String
}
