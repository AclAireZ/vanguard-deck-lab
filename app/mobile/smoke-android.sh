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
timeout 60 adb logcat -d -v time > logcat.txt 2>&1
note "logcat lines: $(wc -l < logcat.txt) · app pid: $(timeout 10 adb shell pidof com.aclairez.vanguarddecklab | tr -d '\r') · top: $(timeout 10 adb shell dumpsys activity activities | grep -m1 -E 'topResumedActivity|mResumedActivity' | tr -d '\r' | sed 's/^ *//')"
timeout 30 adb exec-out screencap -p > android-shot.png
python3 - <<'PY' > shotinfo.txt 2>&1 || true
import zlib,struct
d=open("android-shot.png","rb").read()
print("png bytes",len(d))
PY
note "screenshot: $(cat shotinfo.txt)"
note "webview: $(timeout 20 adb shell dumpsys webviewupdate | grep -m2 -iE 'current webview package|versionName' | tr -d '\r' | tr '\n' ' ')"
grep -E "Capacitor|Console|VGDL|AndroidRuntime|chromium|Uncaught|SyntaxError" logcat.txt | grep -v "Notifying listeners\|No listeners" | tail -40 > console.txt
[ -s console.txt ] || tail -25 logcat.txt > console.txt
msg=$(tail -c 2500 console.txt | sed 's/%/%25/g' | sed ':a;N;$!ba;s/\n/%0A/g')
echo "::notice title=android app console::$msg"
grep -q "\[VGDL\] ready" logcat.txt || { echo "::error::the game page did not start in the Android app"; exit 1; }
! grep -q "FATAL EXCEPTION" logcat.txt || { echo "::error::the app crashed"; exit 1; }
note "game page ready"
