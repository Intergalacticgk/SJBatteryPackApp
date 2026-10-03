const { withProjectBuildGradle } = require('@expo/config-plugins');

// Google Play requires native libraries aligned for 16 KB memory pages
// (enforced starting late 2025 — this is the "Your app does not support
// 16 KB memory page sizes" Play Console error). Expo SDK 52's default NDK
// (r26.1.10909125) does not produce 16KB-aligned .so files; NDK r28+ does,
// by default. expo-build-properties doesn't expose an ndkVersion option at
// this Expo SDK version, so this plugin patches the auto-generated
// android/build.gradle directly during prebuild.
module.exports = function withNdk28(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.contents.includes('ndkVersion = "28.0.12433566"')) {
      return config; // already patched
    }
    const patched = config.modResults.contents.replace(
      /ndkVersion\s*=\s*"[^"]*"/,
      'ndkVersion = "28.0.12433566"'
    );
    if (patched === config.modResults.contents) {
      console.warn('[withNdk28] Could not find an ndkVersion line to patch in android/build.gradle — 16KB page size fix not applied!');
    }
    config.modResults.contents = patched;
    return config;
  });
};
