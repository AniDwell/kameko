const { withProjectBuildGradle, withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAndroidFixes(config) {
  // 1. Intercept the dead FFmpeg request and route it to the live community fork
  config = withProjectBuildGradle(config, (config) => {
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

  // 2. Fix the Firebase vs Expo Notification Color Manifest Conflict
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const app = manifest.manifest.application[0];
    
    // Ensure the 'tools' namespace is available in the XML
    manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    // Find the conflicting Firebase color tag and force Android to accept Expo's color
    if (app['meta-data']) {
      const colorMeta = app['meta-data'].find(
        (item) => item.$['android:name'] === 'com.google.firebase.messaging.default_notification_color'
      );
      
      if (colorMeta) {
        colorMeta.$['tools:replace'] = 'android:resource';
      }
    }
    
    return config;
  });

  return config;
};
