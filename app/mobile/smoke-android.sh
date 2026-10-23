#!/bin/bash
# Runs inside the Android emulator job: install the APK, start it, check the game page came up, take a screenshot. Every step is time-limited and reported as an annotation.
APK=$1
note() { echo "::notice title=android check::$1"; echo "$1"; }
note "emulator up: $(timeout 20 adb shell getprop ro.build.version.release 2>&1 | tr -d '\r')"
for i in $(seq 1 60); do timeout 10 adb shell pm path android >/dev/null 2>&1 && break; sleep 5; done
note "package manager ready after ${i} tries"
timeout 180 adb install -r "$APK" > install.txt 2>&1; note "install: $(tail -c 300 install.txt | tr '\n' ' ')"
grep -q Success install.txt || exit 1
timeout 20 adb logcat -c
timeout 30 adb shell am start -n com.aclairez.vanguarddecklab/.MainActivity; note "started"
sleep 40
timeout 30 adb logcat -d > logcat.txt
timeout 30 adb exec-out screencap -p > android-shot.png
grep -E "Capacitor/Console|VGDL|AndroidRuntime|chromium.*Uncaught" logcat.txt | tail -40 > console.txt
msg=$(tail -c 2500 console.txt | sed 's/%/%25/g' | sed ':a;N;$!ba;s/\n/%0A/g')
echo "::notice title=android app console::$msg"
grep -q "\[VGDL\] ready" logcat.txt || { echo "::error::the game page did not start in the Android app"; exit 1; }
! grep -q "FATAL EXCEPTION" logcat.txt || { echo "::error::the app crashed"; exit 1; }
note "game page ready"
