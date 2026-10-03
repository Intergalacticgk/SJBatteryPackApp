const { withAppBuildGradle } = require('@expo/config-plugins');

// Local builds were OOM-crashing on Android's "Lint Vital" check
// (:app:packageRelease depends on lintVitalAnalyzeRelease), a heavy,
// separate analysis pass unrelated to app functionality. Disabling it
// for release builds only skips that fatal-lint-issue gate; it does
// not disable Proguard/R8, code shrinking, or any actual app behavior.
module.exports = function withDisableLintVital(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.contents.includes('checkReleaseBuilds false')) {
      return config;
    }
    config.modResults.contents = config.modResults.contents.replace(
      /android\s*\{/,
      `android {\n    lintOptions {\n        checkReleaseBuilds false\n        abortOnError false\n    }\n`
    );
    return config;
  });
};
