# React Native / Hermes keep rules are contributed by the RN gradle plugin.
# App-specific keeps:

# Event Collector module is referenced by name from JS across the bridge.
-keep class os.awake.collector.** { *; }

# AndroidX Security (Tink) reflection.
-keep class com.google.crypto.tink.** { *; }
-dontwarn com.google.crypto.tink.**
