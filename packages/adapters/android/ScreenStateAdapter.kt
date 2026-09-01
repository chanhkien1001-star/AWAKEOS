package os.awake.adapters.android

/**
 * STEP 1 SKELETON — Android screen-state Event collector.
 *
 * Observes ACTION_SCREEN_ON / ACTION_SCREEN_OFF / ACTION_USER_PRESENT and
 * KeyguardManager, and produces `ScreenStateChanged` Events (schema 1.0.0).
 *
 * Invariants:
 *  - I-02: only the observed on/off/locked/unlocked transition is emitted.
 *  - I-09: events are buffered locally and drained by the JS bridge. No network.
 */
class ScreenStateAdapter(
    private val clock: () -> Long = System::currentTimeMillis,
    private val newUuid: () -> String = { java.util.UUID.randomUUID().toString() },
) {
    private val pending = ArrayDeque<NormalizedEvent>()

    /** Wire to a BroadcastReceiver for Intent.ACTION_SCREEN_ON/OFF/USER_PRESENT. */
    fun onSystemBroadcast(action: String) {
        val state = when (action) {
            "android.intent.action.SCREEN_ON" -> "On"
            "android.intent.action.SCREEN_OFF" -> "Off"
            "android.intent.action.USER_PRESENT" -> "Unlocked"
            "os.awake.KEYGUARD_LOCKED" -> "Locked"
            else -> return
        }
        pending.addLast(
            NormalizedEvent(
                id = newUuid(),
                occurredAt = clock(),
                type = "ScreenStateChanged",
                sourceType = "System",
                sourceId = "android.screen",
                subjectType = "Screen",
                subjectId = null,
                payload = mapOf("state" to state),
                schemaVersion = "1.0.0",
            ),
        )
    }

    /** Bridge entry point consumed by NativeEventSource.pull(). */
    fun drainPendingEvents(): List<NormalizedEvent> {
        val out = pending.toList()
        pending.clear()
        return out
    }
}

/** Minimal mirror of @awake-os/core Event; serialized to JSON across the bridge. */
data class NormalizedEvent(
    val id: String,
    val occurredAt: Long,
    val type: String,
    val sourceType: String,
    val sourceId: String,
    val subjectType: String,
    val subjectId: String?,
    val payload: Map<String, Any?>,
    val schemaVersion: String,
)
