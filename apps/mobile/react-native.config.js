/**
 * The Event Collector native module is bundled directly inside
 * `android/app/src/main/java/os/awake/collector/` (not an npm package), so
 * autolinking has nothing to do for it — it is registered manually in
 * `MainApplication.kt`. This file just pins the app entry.
 */
module.exports = {
  project: {
    android: {
      sourceDir: './android',
    },
  },
};
