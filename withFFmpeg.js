const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withFFmpeg(config) {
  return withProjectBuildGradle(config, (config) => {
    // Intercept the dead 'com.arthenica' request and route it to the live community fork
    const resolutionPatch = `
allprojects {
    configurations.all {
        resolutionStrategy.eachDependency { details ->
            if (details.requested.group == 'com.arthenica' && details.requested.name.startsWith('ffmpeg-kit-')) {
                details.useTarget(group: 'dev.ffmpegkit-maintained', name: details.requested.name, version: '6.0.3')
            }
        }
    }
}
`;
    if (!config.modResults.contents.includes('dev.ffmpegkit-maintained')) {
      config.modResults.contents += resolutionPatch;
    }
    return config;
  });
};