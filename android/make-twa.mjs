// Writes twa-manifest.json for the Quest app from the live web manifest (instead of the
// interactive `bubblewrap init`). Run: node make-twa.mjs, then npx bubblewrap update && build.
import core from '@meta-quest/bubblewrap-core';
const { TwaManifest } = core;
const twa = await TwaManifest.fromWebManifest('https://meow-meow.io/trilobite/manifest.webmanifest');
Object.assign(twa, {
  packageId: 'io.meowmeow.fossilhunter',
  applicationId: 'io.meowmeow.fossilhunter',
  isMetaQuest: true,
  // 2D: opens as a window in the Quest home, with the game's own "Enter VR" button. Switch to
  // 'immersive' once the game launches straight into WebXR.
  horizonOSAppMode: '2D',
  orientation: 'landscape',
  enableNotifications: false,
  minSdkVersion: 23,
  appVersionName: '0.1.0',
  appVersionCode: 1,
  signingKey: { path: `${process.env.HOME}/.config/fossil-hunter/android.keystore`, alias: 'fossilhunter' },
  generatorApp: 'fossil-hunter/make-twa.mjs',
  // SHA-256 of the signing certificate; also published in /.well-known/assetlinks.json.
  fingerprints: [{ name: 'release', value: '17:66:81:E9:42:BB:AE:81:76:7C:ED:6F:6B:29:83:7C:D7:B4:C7:01:C9:34:2D:20:1B:5A:DE:FA:99:99:4A:9F' }],
});
const err = twa.validate();
if (err) throw new Error(err);
await twa.saveToFile('twa-manifest.json');
console.log(JSON.stringify(twa.toJson(), null, 2));
