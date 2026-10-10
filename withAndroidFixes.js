const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withAndroidFixes(config) {
  // 1. Fix the Firebase vs Expo Notification Color Manifest Conflict
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

  // 2. Protect Firebase and Google Sign-In from the R8 Shrinker
  config = withDangerousMod(config, [
    'android',
    (config) => {
      const proguardPath = path.join(config.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      const customRules = `
# Protect Firebase & React Native Firebase
-keep class com.google.firebase.** { *; }
-keep class io.invertase.firebase.** { *; }
-dontwarn com.google.firebase.**
-dontwarn io.invertase.firebase.**

# Protect Google Play Services (Google Sign-In)
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**
`;
      
      if (fs.existsSync(proguardPath)) {
        const contents = fs.readFileSync(proguardPath, 'utf-8');
        if (!contents.includes('io.invertase.firebase')) {
          fs.writeFileSync(proguardPath, contents + '\n' + customRules);
        }
      } else {
        fs.writeFileSync(proguardPath, customRules);
      }
      return config;
    }
  ]);

  return config;
};
