import Foundation

/// Cross-app visibility on iOS requires the **Family Controls / DeviceActivity**
/// entitlement (`com.apple.developer.family-controls`) and a separate
/// `DeviceActivityMonitor` app-extension target. That is an app-distribution
/// concern, out of scope for the Step 1 scaffold.
///
/// When that entitlement is present, the extension's callbacks
/// (`eventDidReachThreshold`, `intervalDidStart/End`) map to
/// `ApplicationStateChanged` RawEvents exactly as `AppLifecycleObserver` does,
/// and are written into a shared App Group container that this module drains.
///
/// Contract for the extension side (to implement in Step 1.1):
///  - hash the monitored application token via `BundleHasher` before writing;
///  - write only `{ state, packageNameHash }` — no display name, no category;
///  - never make a network call.
enum DeviceActivityBridge {
    /// Reads any RawEvents the monitor extension left in the shared App Group.
    /// Returns `[]` when the entitlement / extension is not configured.
    static func drainSharedContainer(appGroupId: String) -> [RawEvent] {
        guard UserDefaults(suiteName: appGroupId) != nil else { return [] }
        // Step 1.1: decode entries the extension appended, then clear them.
        return []
    }
}
