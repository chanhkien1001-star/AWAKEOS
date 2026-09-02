package os.awake.collector

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.os.Process
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob

/**
 * React Native bridge for the Human Agency OS Event Collector (Step 1).
 *
 * JS surface (see packages/app/src/ingestion/native-module.ts):
 *   start(options): Promise<{ permission }>
 *   stop(): Promise<void>
 *   drainPendingEvents(): Promise<RawNativeEvent[]>
 *   getStatus(): Promise<NativeCollectorStatus>
 *   openPermissionSettings(): Promise<void>
 *
 * Push channel: emits "awake:rawEventBatch" with an array of flat RawNativeEvent
 * maps as they are observed.
 *
 * Invariants: only observed OS transitions are forwarded (I-02); package names
 * are salted-hashed before they leave this process and nothing is sent anywhere
 * but the local JS bridge (I-09).
 */
class AwakeEventCollectorModule(
    private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "AwakeEventCollector"

    private companion object {
        const val ADAPTER_VERSION = "android-step1"
    }

    private val scope = CoroutineScope(SupervisorJob())
    private val buffer = RawEventBuffer()
    private val hasher by lazy { PackageHasher(reactContext.applicationContext) }

    private var screenReceiver: ScreenStateReceiver? = null
    private var usageReader: AppUsageReader? = null
    private var running = false

    /** Fan a freshly observed event to both the push channel and the drain buffer. */
    private fun handle(event: RawEvent) {
        buffer.add(event)
        val batch: WritableArray = Arguments.createArray().apply { pushMap(event.toWritableMap()) }
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("awake:rawEventBatch", batch)
        }
    }

    @ReactMethod
    fun start(options: ReadableMap, promise: Promise) {
        try {
            val observe = options.getMap("observe")
            val wantScreen = observe?.getBoolean("screenState") ?: true
            val wantApp = observe?.getBoolean("applicationState") ?: true
            val pollMs = if (options.hasKey("usagePollIntervalMs")) options.getInt("usagePollIntervalMs").toLong() else 5_000L

            if (wantScreen && screenReceiver == null) {
                screenReceiver = ScreenStateReceiver(::handle).also { it.register(reactContext) }
            }
            if (wantApp && usageReader == null && hasUsageAccess()) {
                usageReader = AppUsageReader(reactContext.applicationContext, hasher, ::handle, pollMs)
                    .also { it.start(scope) }
            }
            running = true
            promise.resolve(Arguments.createMap().apply { putString("permission", currentPermission()) })
        } catch (t: Throwable) {
            promise.reject("start_failed", t)
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        screenReceiver?.unregister(reactContext); screenReceiver = null
        usageReader?.stop(); usageReader = null
        running = false
        promise.resolve(null)
    }

    @ReactMethod
    fun drainPendingEvents(promise: Promise) {
        val out: WritableArray = Arguments.createArray()
        buffer.drain().forEach { out.pushMap(it.toWritableMap()) }
        promise.resolve(out)
    }

    @ReactMethod
    fun getStatus(promise: Promise) {
        promise.resolve(Arguments.createMap().apply {
            putBoolean("running", running)
            putString("permission", currentPermission())
            putInt("pendingNative", buffer.size())
            putString("adapterVersion", ADAPTER_VERSION)
        })
    }

    @ReactMethod
    fun openPermissionSettings(promise: Promise) {
        val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(intent)
        promise.resolve(null)
    }

    // "granted" if usage access is on, else "partial" (screen signals still work).
    private fun currentPermission(): String = if (hasUsageAccess()) "granted" else "partial"

    private fun hasUsageAccess(): Boolean {
        val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = appOps.unsafeCheckOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            reactContext.packageName,
        )
        return mode == AppOpsManager.MODE_ALLOWED
    }

    override fun invalidate() {
        screenReceiver?.unregister(reactContext)
        usageReader?.stop()
        super.invalidate()
    }
}
