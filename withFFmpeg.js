const { withProjectBuildGradle, withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

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
    
    manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

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

  // 3. Stop R8/ProGuard from deleting required FFmpeg exceptions
  config = withDangerousMod(config, [
    'android',
    (config) => {
      const proguardPath = path.join(config.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      const ffmpegRules = `\n# Protect FFmpegKit from R8 Shrinker\n-keep class com.arthenica.** { *; }\n-dontwarn com.arthenica.**\n`;
      
      if (fs.existsSync(proguardPath)) {
        const contents = fs.readFileSync(proguardPath, 'utf-8');
        if (!contents.includes('-dontwarn com.arthenica.**')) {
          fs.writeFileSync(proguardPath, contents + ffmpegRules);
        }
      } else {
        fs.writeFileSync(proguardPath, ffmpegRules);
      }
      return config;
    }
  ]);

  return config;
};
