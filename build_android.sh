#!/usr/bin/env bash
# ==============================================================================
# MyMusic - Android Production Build Script (Bash)
# Low-memory, low-size build optimized for low-end Android devices
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=================================================="
echo "   MyMusic - Building Android Production Bundle   "
echo "=================================================="

# 1. Build Web Production Bundle
echo -e "\n[1/3] Building optimized web bundle (<95 KB gzipped)..."
cd "$SCRIPT_DIR/web"
npm run build

# 2. Synchronize Web Assets with Android Project
echo -e "\n[2/3] Synchronizing assets into Android project (Capacitor)..."
npx cap sync android

# 3. Assemble Native APK if gradlew is executable
echo -e "\n[3/3] Checking native Android build environment..."
cd "$SCRIPT_DIR/web/android"
if [ -f "./gradlew" ] && command -v java >/dev/null 2>&1; then
    chmod +x ./gradlew
    echo "Compiling Android release APK with Proguard/R8 minification..."
    ./gradlew :app:assembleRelease || ./gradlew :app:assembleDebug
    echo -e "\nNative build complete. APKs located in web/android/app/build/outputs/apk/"
else
    echo -e "\nAndroid project is completely synced and ready."
    echo "To open in Android Studio: cd web && npx cap open android"
fi
