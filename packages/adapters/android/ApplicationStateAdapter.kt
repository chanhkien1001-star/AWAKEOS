package os.awake.adapters.android

import java.security.MessageDigest

/**
 * STEP 1 SKELETON — Android foreground-application Event collector.
 *
 * Polls UsageStatsManager.queryEvents(...) (MOVE_TO_FOREGROUND / MOVE_TO_BACKGROUND)
 * and emits `ApplicationStateChanged` Events (schema 1.0.0).
 *
 * Invariants:
 *  - I-02: emits only the observed foreground/background transition.
 *  - I-09: raw package name is salted-hashed here and never leaves in the clear;
 *    buffer is drained locally by the bridge, no network.
 */
class ApplicationStateAdapter(
    /** Per-install salt from the Android keystore. Never synced. */
    private val installSalt: ByteArray,
    private val clock: () -> Long = System::currentTimeMillis,
    private val newUuid: () -> String = { java.util.UUID.randomUUID().toString() },
) {
    private val pending = ArrayDeque<NormalizedEvent>()

    /** @param rawEventType one of "MOVE_TO_FOREGROUND", "MOVE_TO_BACKGROUND", "TERMINATED". */
    fun onUsageEvent(packageName: String, rawEventType: String, timestampMs: Long) {
        val state = when (rawEventType) {
            "MOVE_TO_FOREGROUND" -> "Foreground"
            "MOVE_TO_BACKGROUND" -> "Background"
            "TERMINATED" -> "Terminated"
            else -> return
        }
        val hash = hashPackage(packageName)
        pending.addLast(
            NormalizedEvent(
                id = newUuid(),
                occurredAt = timestampMs.takeIf { it > 0 } ?: clock(),
                type = "ApplicationStateChanged",
                sourceType = "System",
                sourceId = "android.usage-events",
                subjectType = "Application",
                subjectId = hash,
                payload = mapOf("state" to state, "packageNameHash" to hash),
                schemaVersion = "1.0.0",
            ),
        )
    }

    fun drainPendingEvents(): List<NormalizedEvent> {
        val out = pending.toList()
        pending.clear()
        return out
    }

    private fun hashPackage(pkg: String): String {
        val md = MessageDigest.getInstance("SHA-256")
        md.update(installSalt)
        val digest = md.digest(pkg.toByteArray(Charsets.UTF_8))
        return "sha256:" + android.util.Base64.encodeToString(
            digest,
            android.util.Base64.URL_SAFE or android.util.Base64.NO_PADDING or android.util.Base64.NO_WRAP,
        )
    }
}
