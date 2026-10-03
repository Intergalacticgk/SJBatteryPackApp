const { withAppBuildGradle } = require('@expo/config-plugins');

// Google Play requires native libraries aligned for 16 KB memory pages
// (enforced starting late 2025 -- the "Your app does not support 16 KB
// memory page sizes" Play Console error). The react-native-gradle-plugin
// sets its own default ndkVersion (via rootProject.ext.ndkVersion), which
// may predate 16KB-page support. expo-build-properties has no ndkVersion
// option, so this plugin hardcodes NDK r28 (16KB-aligned by default)
// directly in android/app/build.gradle, overriding whatever default the
// RN gradle plugin would otherwise apply.
const NDK_VERSION = '28.0.12433566';

module.exports = function withNdk28(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.contents.includes(`ndkVersion "${NDK_VERSION}"`)) {
      return config; // already patched
    }
    const patched = config.modResults.contents.replace(
      /ndkVersion\s+rootProject\.ext\.ndkVersion/,
      `ndkVersion "${NDK_VERSION}"`
    );
    if (patched === config.modResults.contents) {
      console.warn(
        '[withNdk28] Could not find the expected "ndkVersion rootProject.ext.ndkVersion" line in android/app/build.gradle -- 16KB page size fix not applied!'
      );
    }
    config.modResults.contents = patched;
    return config;
  });
};
