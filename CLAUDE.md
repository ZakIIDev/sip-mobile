# CLAUDE.md - SIP Mobile

> **Ecosystem:** [sip-protocol/CLAUDE.md](https://github.com/sip-protocol/sip-protocol/blob/main/CLAUDE.md)

**Purpose:** Native privacy wallet for iOS, Android & Solana Mobile (Seeker)

---

## Quick Reference

**Stack:** Expo 52, React Native, NativeWind 4, Zustand 5, Expo Router

```bash
pnpm install              # Install
npx expo start            # Dev server
pnpm typecheck            # Type check
eas build --platform android --profile production --local  # Local APK
```

**Tabs:** Home | Send | Receive | Swap | Settings

**Wallets:** Privy (embedded) | MWA (Android) | Phantom deeplinks (iOS)

---

## Structure

```
app/(tabs)/     # Tab screens (index, send, receive, swap, settings)
src/components/ # UI components (Button, Card, Input, Modal, Toggle)
src/stores/     # Zustand stores (wallet, settings, privacy, swap, toast)
publishing/     # APK builds, dApp Store config
```

---

## Build & Publishing

> **Details:** [publishing/BUILD-WORKFLOW.md](publishing/BUILD-WORKFLOW.md)

**APK Optimization:** ARM only, ProGuard, shrink resources (112MB → ~45MB)

**dApp Store:** Published as App NFT `2THAY9h4MaxsCtbm2WVj1gn2NMbVN3GUhLQ1EkMvqQby`

**Cost/release:** ~0.025 SOL (Arweave ~0.02 + NFT rent ~0.002 + fees)

---

## Build & Debug Workflow (IMPORTANT)

### Build Strategy

> **⚠️ NEVER use Expo cloud builds** — Free account has limited quota. Always build locally.

```bash
# Local APK build (use this, not `eas build` without --local)
eas build --platform android --profile production --local

# Output: ~/local-dev/sip-mobile/build-*.apk
```

### ADB over WiFi Setup (Seeker / Android)

We use **ADB over WiFi** for all Android/Seeker debugging. No USB cables needed.

**First-time pairing:**
```bash
# 1. On device: Settings → Developer Options → Wireless debugging → ON
# 2. Tap "Pair device with pairing code" → note IP:PORT and CODE

# 3. On Mac:
adb pair <IP>:<PAIRING_PORT> <CODE>
# Example: adb pair 192.168.1.100:37123 123456

# 4. Connect (use port from main Wireless debugging screen, not pairing port):
adb connect <IP>:<PORT>
# Example: adb connect 192.168.1.100:43567

# 5. Verify:
adb devices
```

**Daily reconnect** (after pairing is saved):
```bash
adb connect <IP>:<PORT>
```

### Install & Launch

```bash
# Install APK to device
adb install -r build-*.apk

# Launch app
adb shell am start -n com.sipprotocol.mobile/.MainActivity

# Force stop
adb shell am force-stop com.sipprotocol.mobile
```

### Debugging Commands

```bash
# Live logs (all)
adb logcat

# Filter React Native / Expo / SIP
adb logcat | grep -iE "(ReactNative|Expo|SIP|Error|Exception)"

# Errors only
adb logcat *:E

# Clear log buffer
adb logcat -c

# Save logs to file
adb logcat -d > debug.log
```

### Screen Sharing with scrcpy

We use **scrcpy** for screen mirroring during debug sessions.

```bash
# Install (if not installed)
brew install scrcpy

# Mirror screen (auto-connects to ADB device)
scrcpy

# With options
scrcpy --max-size 1024 --bit-rate 4M    # Lower quality, smoother
scrcpy --record session.mp4              # Record session
scrcpy --stay-awake                      # Keep screen on
scrcpy --turn-screen-off                 # Mirror with screen off (saves battery)
```

### Screenshot & Screen Record

```bash
# Screenshot
adb exec-out screencap -p > screenshot.png

# Screen record (max 3 min)
adb shell screenrecord /sdcard/demo.mp4
# Ctrl+C to stop, then:
adb pull /sdcard/demo.mp4
```

### Debug Workflow Summary

```
┌─────────────────────────────────────────────────────────────┐
│  SIP MOBILE DEBUG WORKFLOW                                  │
├─────────────────────────────────────────────────────────────┤
│  1. Build locally    → eas build --platform android --local │
│  2. Connect ADB WiFi → adb connect <IP>:<PORT>              │
│  3. Install APK      → adb install -r build-*.apk           │
│  4. Mirror screen    → scrcpy                               │
│  5. Watch logs       → adb logcat | grep -i "error\|sip"    │
│  6. Iterate          → Fix → Rebuild → Reinstall            │
├─────────────────────────────────────────────────────────────┤
│  ⚠️  NEVER: eas build (without --local)                     │
│  ⚠️  NEVER: expo publish (uses cloud quota)                 │
│  ✅  ALWAYS: Local builds + ADB + scrcpy                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Guidelines

**DO:** Test real devices, NativeWind classes, SecureStore for keys, handle offline

**DON'T:** Block main thread, ignore keyboard/safe areas, hard-code dimensions, use Expo cloud builds

**Packages:** `@sip-protocol/sdk`, `@noble/curves`, `@noble/hashes`, `expo-secure-store`

---

**Status:** v0.1.0 | dApp Store submitted (awaiting review) | 531 tests passing
