#!/bin/bash
# Makes the native projects for the phone app. Run from app/mobile after `node build.mjs` (with VG_VERSION=1.0.N) at the repo root.
#   bash prepare.sh android|ios <version e.g. 1.0.42> <build number e.g. 42>
set -e
cd "$(dirname "$0")"
P=$1; V=$2; N=$3
mkdir -p www && cp ../../dist/local/VanguardDeckLab.html www/index.html
[ -d node_modules ] || npm install --no-audit --no-fund
[ -d "$P" ] || npx cap add "$P"
if [ "$P" = android ]; then
  npx capacitor-assets generate --android --iconBackgroundColor '#0b0710' --iconBackgroundColorDark '#0b0710' --splashBackgroundColor '#05060f' --splashBackgroundColorDark '#05060f'
  sed -i -E "s/versionCode [0-9]+/versionCode $N/; s/versionName \"[^\"]*\"/versionName \"$V\"/" android/app/build.gradle
  grep -E "versionCode|versionName" android/app/build.gradle
else
  npx capacitor-assets generate --ios --iconBackgroundColor '#0b0710' --splashBackgroundColor '#05060f' --splashBackgroundColorDark '#05060f'
  PL=ios/App/App/Info.plist
  /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $V" $PL 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :CFBundleShortVersionString string $V" $PL
  /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $N" $PL 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :CFBundleVersion string $N" $PL
  sed -i '' -E "s/MARKETING_VERSION = [^;]+;/MARKETING_VERSION = $V;/g; s/CURRENT_PROJECT_VERSION = [^;]+;/CURRENT_PROJECT_VERSION = $N;/g" ios/App/App.xcodeproj/project.pbxproj
fi
npx cap sync "$P"
