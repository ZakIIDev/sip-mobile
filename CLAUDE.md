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

## Versioning (IMPORTANT)

> **Bump version BEFORE every build** — Same version = store won't recognize update.

```bash
# app.json — increment BOTH before building:
"version": "0.1.1"              # versionName (human-readable)
"android": { "versionCode": 2 } # MUST increment for store updates
```

---

## Debug Workflow

> **⚠️ NEVER use Expo cloud builds** — Free tier quota limited. Local only.

```bash
# Build (ALWAYS --local)
eas build --platform android --profile production --local

# ADB WiFi: Device → Developer Options → Wireless debugging → Pair
adb pair <IP>:<PORT> <CODE>    # First time only
adb connect <IP>:<PORT>        # Daily reconnect

# Install & run
adb install -r build-*.apk
adb shell am start -n com.sipprotocol.mobile/.MainActivity

# Debug
adb logcat | grep -iE "error|exception|sip"   # Logs
scrcpy                                         # Screen mirror
scrcpy --record session.mp4                    # Record
```

---

## Guidelines

**DO:** Test real devices, NativeWind classes, SecureStore for keys, handle offline

**DON'T:** Block main thread, ignore keyboard/safe areas, use Expo cloud builds

**Packages:** `@sip-protocol/sdk`, `@noble/curves`, `@noble/hashes`, `expo-secure-store`

---

**Status:** v0.1.0 | dApp Store submitted (awaiting review) | 531 tests passing
