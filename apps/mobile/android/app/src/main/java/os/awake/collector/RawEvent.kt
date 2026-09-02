package os.awake.collector

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

/**
 * Flat, JS-bound mirror of `@awake-os/core` `RawNativeEvent`. The adapter fills
 * this from an OS signal and nothing else — no derived or interpreted fields
 * (I-02). The `@awake-os/core` normalizer is the trust boundary that turns one
 * of these into a contract-valid Event.
 */
data class RawEvent(
    val occurredAt: Long,
    val type: String,
    val sourceType: String,
    val sourceId: String,
    val subjectType: String,
    val subjectId: String?,
    val payload: Map<String, Any?>,
) {
    fun toWritableMap(): WritableMap = Arguments.createMap().apply {
        putDouble("occurredAt", occurredAt.toDouble())
        putString("type", type)
        putString("sourceType", sourceType)
        putString("sourceId", sourceId)
        putString("subjectType", subjectType)
        if (subjectId != null) putString("subjectId", subjectId) else putNull("subjectId")
        putMap("payload", Arguments.makeNativeMap(payload))
    }

    companion object {
        fun screen(state: String, occurredAt: Long) = RawEvent(
            occurredAt = occurredAt,
            type = "ScreenStateChanged",
            sourceType = "System",
            sourceId = "android.screen",
            subjectType = "Screen",
            subjectId = null,
            payload = mapOf("state" to state),
        )

        fun application(state: String, packageNameHash: String, occurredAt: Long) = RawEvent(
            occurredAt = occurredAt,
            type = "ApplicationStateChanged",
            sourceType = "System",
            sourceId = "android.usage-events",
            subjectType = "Application",
            subjectId = packageNameHash,
            payload = mapOf("state" to state, "packageNameHash" to packageNameHash),
        )
    }
}
