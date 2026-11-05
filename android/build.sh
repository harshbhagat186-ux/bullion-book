#!/usr/bin/env bash
# Builds Bullion Book APK without Gradle, using Ubuntu's android-sdk packages:
#   apt-get install android-sdk android-sdk-platform-23 apksigner dalvik-exchange
set -euo pipefail
cd "$(dirname "$0")"
SDK=/usr/lib/android-sdk
JAR=$SDK/platforms/android-23/android.jar
OUT=build
VER=${VER:-1.0}
ASSETS=${ASSETS:-.assets}
rm -rf .assets; mkdir -p .assets; cp -r ../web/. .assets/; [ -n "${APP_URL:-}" ] && echo "$APP_URL" > .assets/app_url.txt
rm -rf "$OUT" && mkdir -p "$OUT/classes" "$OUT/gen"

# 1. resources + manifest
aapt package -f -m -J "$OUT/gen" -M AndroidManifest.xml -S res -I "$JAR"
# 2. java
javac -nowarn --release 8 -cp "$JAR" -d "$OUT/classes" $(find java "$OUT/gen" -name '*.java') 2>&1 | grep -v 'bootstrap\|obsolete\|warning' || true
# 3. dex
dalvik-exchange --dex --min-sdk-version=21 --output="$OUT/classes.dex" "$OUT/classes"
# 4. package
aapt package -f -M AndroidManifest.xml -S res -A "$ASSETS" -I "$JAR" -F "$OUT/app.unsigned.apk"
(cd "$OUT" && aapt add app.unsigned.apk classes.dex >/dev/null)
zipalign -f -p 4 "$OUT/app.unsigned.apk" "$OUT/app.aligned.apk"
# 5. sign (keystore kept next to this script so updates install over the old app)
if [ ! -f release.keystore ]; then
  keytool -genkeypair -keystore release.keystore -alias bullion -keyalg RSA -keysize 2048 \
    -validity 10000 -storepass bullion123 -keypass bullion123 -dname "CN=Bullion Book, O=Shop, C=IN"
fi
apksigner sign --ks release.keystore --ks-pass pass:bullion123 --key-pass pass:bullion123 \
  --out "$OUT/BullionBook-$VER.apk" "$OUT/app.aligned.apk"
apksigner verify "$OUT/BullionBook-$VER.apk" && echo "Built $OUT/BullionBook-$VER.apk"
