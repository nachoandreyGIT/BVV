const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Config Plugin de Expo para declarar android.hardware.screen.portrait como opcional
 * (android:required="false") en AndroidManifest.xml.
 * Evita que Google Play Console bloquee o restrinja la app en tablets, plegables,
 * Chromebooks y dispositivos Android 16 / XR al usar orientation: "portrait".
 */
function withOptionalPortrait(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;

    if (!Array.isArray(manifest['uses-feature'])) {
      manifest['uses-feature'] = [];
    }

    const featureName = 'android.hardware.screen.portrait';
    const existing = manifest['uses-feature'].find(
      (item) => item?.$?.['android:name'] === featureName
    );

    if (existing) {
      existing.$['android:required'] = 'false';
    } else {
      manifest['uses-feature'].push({
        $: {
          'android:name': featureName,
          'android:required': 'false',
        },
      });
    }

    return modConfig;
  });
}

module.exports = withOptionalPortrait;
