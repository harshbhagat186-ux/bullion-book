# Bullion Book

Billing, stock, Sauda and Baki/Jama app for a gold & silver bullion shop.
Runs on Android (APK), iPhone and laptop (web app), with live online sync and login via Firebase.

- `web/` – the app (HTML/JS). `web/config.js` holds the public Firebase web config and owner email.
- `firebase/firestore.rules` – security rules: only the owner and approved staff emails can read or write.
- `firebase.json` – Firebase Hosting + rules deploy (`firebase deploy --only hosting,firestore:rules`).
- `android/` – Android wrapper. Build with `APP_URL=https://<project>.web.app/ VER=1.4 ./build.sh`
  (needs Ubuntu packages android-sdk android-sdk-platform-23 apksigner dalvik-exchange and the signing keystore, which is NOT in this repo).

No shop data is stored in this repository.
