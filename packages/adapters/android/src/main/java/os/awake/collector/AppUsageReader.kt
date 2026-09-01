package os.awake.collector

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Reads foreground/background transitions from UsageStatsManager and emits
 * `ApplicationStateChanged` RawEvents with a SALTED HASH of the package name
 * (I-09) — the raw package id never enters a RawEvent.
 *
 * UsageStats has no realtime callback, so we poll `queryEvents(sinceMs, nowMs)`
 * on a cadence and forward only events newer than the last one seen. Requires the
 * user to have granted "Usage access"; if not granted, `queryEvents` yields
 * nothing and the collector simply produces no application events.
 *
 * I-02: only the MOVE_TO_FOREGROUND / MOVE_TO_BACKGROUND / ACTIVITY_STOPPED
 * transition and the hashed identity are reported.
 */
class AppUsageReader(
    private val context: Context,
    private val hasher: PackageHasher,
    private val onEvent: (RawEvent) -> Unit,
    private val pollIntervalMs: Long = 5_000L,
) {
    private val usm by lazy { context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager }
    private var job: Job? = null
    private var lastSeenMs: Long = System.currentTimeMillis()
    private val ownPackage = context.packageName

    fun start(scope: CoroutineScope) {
        if (job?.isActive == true) return
        job = scope.launch(Dispatchers.Default) {
            while (isActive) {
                runCatching { pollOnce() }
                delay(pollIntervalMs)
            }
        }
    }

    fun stop() {
        job?.cancel()
        job = null
    }

    private fun pollOnce() {
        val now = System.currentTimeMillis()
        val events = usm.queryEvents(lastSeenMs, now)
        val e = UsageEvents.Event()
        var maxTs = lastSeenMs
        while (events.getNextEvent(e)) {
            if (e.timeStamp <= lastSeenMs) continue
            maxTs = maxOf(maxTs, e.timeStamp)

            val state = when (e.eventType) {
                UsageEvents.Event.MOVE_TO_FOREGROUND -> "Foreground"
                UsageEvents.Event.MOVE_TO_BACKGROUND -> "Background"
                UsageEvents.Event.ACTIVITY_STOPPED -> "Background"
                else -> continue
            }
            val pkg = e.packageName ?: continue
            if (pkg == ownPackage) continue // never observe ourselves

            onEvent(RawEvent.application(state, hasher.hash(pkg), e.timeStamp))
        }
        lastSeenMs = maxTs
    }
}
