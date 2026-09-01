package os.awake.collector

import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter

/**
 * Observes screen power + lock transitions and emits `ScreenStateChanged`
 * RawEvents. These broadcasts require no permission.
 *
 *   ACTION_SCREEN_ON    -> "On"
 *   ACTION_SCREEN_OFF   -> "Off"
 *   ACTION_USER_PRESENT -> "Unlocked"
 *   (screen on while keyguard locked) -> "Locked"
 *
 * I-02: only the observed transition is reported — no notification content, no
 * app in focus, nothing else.
 */
class ScreenStateReceiver(
    private val onEvent: (RawEvent) -> Unit,
    private val clock: () -> Long = System::currentTimeMillis,
) : BroadcastReceiver() {

    fun register(context: Context) {
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_ON)
            addAction(Intent.ACTION_SCREEN_OFF)
            addAction(Intent.ACTION_USER_PRESENT)
        }
        context.registerReceiver(this, filter)
    }

    fun unregister(context: Context) {
        runCatching { context.unregisterReceiver(this) }
    }

    override fun onReceive(context: Context, intent: Intent) {
        val now = clock()
        when (intent.action) {
            Intent.ACTION_SCREEN_OFF -> onEvent(RawEvent.screen("Off", now))
            Intent.ACTION_USER_PRESENT -> onEvent(RawEvent.screen("Unlocked", now))
            Intent.ACTION_SCREEN_ON -> {
                val km = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
                onEvent(RawEvent.screen(if (km.isKeyguardLocked) "Locked" else "On", now))
            }
        }
    }
}
