import Foundation

/// Flat, JS-bound mirror of `@awake-os/core` `RawNativeEvent`. Filled directly
/// from an OS signal — no derived or interpreted fields (I-02).
struct RawEvent {
    let occurredAt: Int64
    let type: String
    let sourceType: String
    let sourceId: String
    let subjectType: String
    let subjectId: String?
    let payload: [String: Any]

    func toDictionary() -> [String: Any] {
        var dict: [String: Any] = [
            "occurredAt": occurredAt,
            "type": type,
            "sourceType": sourceType,
            "sourceId": sourceId,
            "subjectType": subjectType,
            "payload": payload,
        ]
        dict["subjectId"] = subjectId as Any? ?? NSNull()
        return dict
    }

    static func screen(_ state: String, _ occurredAt: Int64) -> RawEvent {
        RawEvent(
            occurredAt: occurredAt,
            type: "ScreenStateChanged",
            sourceType: "System",
            sourceId: "ios.screen",
            subjectType: "Screen",
            subjectId: nil,
            payload: ["state": state]
        )
    }

    static func application(_ state: String, _ packageNameHash: String, _ occurredAt: Int64) -> RawEvent {
        RawEvent(
            occurredAt: occurredAt,
            type: "ApplicationStateChanged",
            sourceType: "System",
            sourceId: "ios.app-lifecycle",
            subjectType: "Application",
            subjectId: packageNameHash,
            payload: ["state": state, "packageNameHash": packageNameHash]
        )
    }
}

func nowMs() -> Int64 { Int64(Date().timeIntervalSince1970 * 1000) }
