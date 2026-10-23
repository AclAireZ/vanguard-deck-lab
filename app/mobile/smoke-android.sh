#!/bin/bash
# Runs inside the Android emulator job: install the APK, start it, check the game page came up, take a screenshot.
APK=$1
adb install -r "$APK" || exit 1
adb logcat -c
adb shell am start -n com.aclairez.vanguarddecklab/.MainActivity
sleep 40
adb logcat -d > logcat.txt
adb exec-out screencap -p > android-shot.png
grep -E "Capacitor/Console|VGDL|AndroidRuntime|chromium.*Uncaught" logcat.txt | tail -40 > console.txt
cat console.txt
msg=$(tail -c 2500 console.txt | sed 's/%/%25/g' | sed ':a;N;$!ba;s/\n/%0A/g')
echo "::notice title=android app console::$msg"
grep -q "\[VGDL\] ready" logcat.txt || { echo "::error::the game page did not start in the Android app"; exit 1; }
! grep -q "FATAL EXCEPTION" logcat.txt || { echo "::error::the app crashed"; exit 1; }
