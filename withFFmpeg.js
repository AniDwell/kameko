const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withFFmpeg(config) {
  return withProjectBuildGradle(config, (config) => {
    // Inject the correct Maven Central version into Android's build.gradle
    if (!config.modResults.contents.includes('ffmpegKitVersion')) {
      config.modResults.contents = config.modResults.contents.replace(
        /ext\s*\{/,
        `ext {\n        ffmpegKitPackage = "https"\n        ffmpegKitVersion = "6.0"\n`
      );
    }
    return config;
  });
};
