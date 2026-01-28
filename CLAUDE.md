# CLAUDE.md - SIP Mobile

> **Ecosystem:** [sip-protocol/CLAUDE.md](https://github.com/sip-protocol/sip-protocol/blob/main/CLAUDE.md)

**Tagline:** "Privacy in Your Pocket"
**Purpose:** Daily privacy wallet for Solana — native key management, quick payments, on-the-go swaps
**Target:** iOS App Store, Google Play, Solana dApp Store (Seeker)

---

## 🎯 PRODUCT POSITIONING

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SIP PRODUCT FAMILY (Jupiter Model)                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  @sip-protocol/sdk — THE PRIVACY STANDARD                                   │
│  "Any app can add privacy with one line of code"                           │
│                                                                             │
│  ┌─────────────────────────────┐   ┌─────────────────────────────┐         │
│  │  app.sip-protocol.org      │   │  SIP Privacy (Mobile)       │         │
│  │  ───────────────────────   │   │  ────────────────────────   │         │
│  │  "Privacy Command Center"  │   │  "Privacy in Your Pocket"   │         │
│  │                            │   │                             │         │
│  │  • Power users/Enterprise  │   │  • Consumers                │         │
│  │  • Complex visualizations  │   │  • Quick payments/swaps     │         │
│  │  • Compliance dashboards   │   │  • Native key management    │         │
│  │  • Audit trails/Reports    │   │  • Biometric security       │         │
│  │  • SDK showcase            │   │  • On-the-go privacy        │         │
│  │                            │   │                             │         │
│  │  → sip-app repo            │   │  ← YOU ARE HERE             │         │
│  └─────────────────────────────┘   └─────────────────────────────┘         │
│                                                                             │
│  COMPANION PRODUCTS — Same brand, platform-optimized experiences            │
│  Like jup.ag (web) + Jupiter Mobile (app) — NOT 1:1 clones                 │
│                                                                             │
│  BOTH are real products with real users — NOT demos                        │
│  BOTH showcase SDK capabilities → drive developer adoption                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### sip-mobile Differentiators (Mobile Strengths)

| Capability | Why Mobile Excels |
|------------|-------------------|
| **Native Key Management** | SecureStore + Biometrics — keys never leave device |
| **Quick Payments** | Scan QR, send in seconds, biometric confirm |
| **On-the-go Swaps** | Jupiter DEX with privacy toggle — trade anywhere |
| **Camera Integration** | Native QR scanning for stealth addresses |
| **Push Notifications** | Payment received alerts (planned) |
| **Consumer UX** | Simple privacy toggle, no jargon |

### Shared with sip-app (Must Be Identical)

- Core privacy primitives (stealth addresses, commitments, viewing keys)
- Privacy levels (transparent / shielded / compliant)
- Payment protocol (send / receive / scan / claim / disclose)
- Viewing key disclosure for compliance

### Feature Parity Matrix

| Feature | sip-mobile | sip-app (Web) | Notes |
|---------|------------|---------------|-------|
| Send Payments | ✅ Full | ✅ Full | Same core |
| Receive (Stealth) | ✅ Full | ✅ Full | Same core |
| Scan Payments | ✅ Full | ✅ Full | Mobile has native camera |
| Claim Payments | ✅ Full | ✅ Full | Same core |
| View History | ✅ Full | ✅ Full | Different viz |
| Viewing Key Disclosure | ✅ Full | ✅ Full | Compliance-critical |
| Jupiter DEX | ✅ Full | 🔲 Scaffolded | Mobile-first for swaps |
| Privacy Score | ✅ Basic | ✅ Full (D3) | Web excels at viz |
| Compliance Dashboard | ✅ Basic | 🔲 Scaffolded | Web for enterprise |
| Native Key Mgmt | ✅ Full | ❌ N/A | Mobile-only |
| Biometric Auth | ✅ Full | ❌ N/A | Mobile-only |
| Multi-Account | ✅ Full | 🔲 Planned | Mobile-first |

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

---

## Wallet Architecture

**Philosophy:** SIP Privacy IS the wallet — users manage keys directly, no external wallet required.

### Wallet Strategy

| Method | Platform | Priority | Status |
|--------|----------|----------|--------|
| **Native Wallet** | All | PRIMARY | ✅ Complete |
| **Seed Vault** | Seeker | PRIMARY | ✅ Complete |
| MWA | Android | Optional | ✅ Available |
| Phantom Deeplinks | iOS | Optional | ✅ Available |
| ~~Privy~~ | ~~All~~ | REMOVED | ❌ Removed (#71) |

### Key Management

```
┌─────────────────────────────────────────────────────────────┐
│  PRIMARY: Native Wallet (useNativeWallet)                   │
│  ├── Generate new wallet (BIP39 mnemonic)                   │
│  ├── Import seed phrase (12/24 words)                       │
│  ├── Import private key (base58)                            │
│  ├── SecureStore + Biometrics for security                  │
│  └── Solana derivation: m/44'/501'/0'/0'                    │
├─────────────────────────────────────────────────────────────┤
│  SEEKER: Direct Seed Vault Integration                      │
│  └── No Phantom middleman — direct Seed Vault API           │
├─────────────────────────────────────────────────────────────┤
│  OPTIONAL: External Wallet Connection                       │
│  ├── MWA (Android) — connect to Phantom/Solflare            │
│  └── Phantom Deeplinks (iOS) — connect to Phantom           │
└─────────────────────────────────────────────────────────────┘
```

### Security Model

| Layer | Implementation |
|-------|----------------|
| Key Storage | `expo-secure-store` (Keychain/Keystore) |
| Access Control | Biometric auth via `expo-local-authentication` |
| Derivation | BIP39 → BIP44 (Solana path) |
| Memory | Keys cleared after signing operations |
| Backup | Mnemonic export (biometric required) |

### Key Files

```
src/hooks/useNativeWallet.ts   # Primary wallet hook
src/hooks/useSeedVault.ts      # Seeker Seed Vault integration
src/hooks/useMWA.ts            # Optional: Android external wallet
src/hooks/usePhantomDeeplink.ts # Optional: iOS external wallet
src/utils/keyStorage.ts        # SecureStore utilities
app/(auth)/wallet-setup.tsx    # Wallet setup entry point
app/(auth)/create-wallet.tsx   # Create new wallet flow
app/(auth)/import-wallet.tsx   # Import existing wallet flow
app/settings/backup.tsx        # View/backup recovery phrase
```

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

**DO:**
- Test on real devices (especially Seeker for Seed Vault)
- Use NativeWind classes for styling
- Use SecureStore for ALL key storage
- Handle offline gracefully
- Require biometric for sensitive operations

**DON'T:**
- Block main thread with crypto operations
- Ignore keyboard/safe areas
- Use Expo cloud builds (local only)
- Log or expose private keys
- Store keys in AsyncStorage (use SecureStore)

**Packages:**
- `@sip-protocol/sdk` — Privacy primitives
- `@noble/curves`, `@noble/hashes` — Cryptography
- `expo-secure-store` — Key storage
- `expo-local-authentication` — Biometrics
- `@scure/bip39`, `@scure/bip32` — Key derivation

---

## Related Issues

- [#61](https://github.com/sip-protocol/sip-mobile/issues/61) — EPIC: Native Wallet Architecture
- [#67](https://github.com/sip-protocol/sip-mobile/issues/67) — useNativeWallet hook
- [#68](https://github.com/sip-protocol/sip-mobile/issues/68) — keyStorage utilities
- [#70](https://github.com/sip-protocol/sip-mobile/issues/70) — Seed Vault integration

---

## Related Repositories

| Repo | Purpose | Relationship |
|------|---------|--------------|
| [sip-protocol](https://github.com/sip-protocol/sip-protocol) | Core SDK | Imports SDK |
| [sip-app](https://github.com/sip-protocol/sip-app) | **Companion web app** | Same product family |
| [docs-sip](https://github.com/sip-protocol/docs-sip) | Documentation | Documents usage |

---

**Last Updated:** 2026-01-28
**Status:** v0.1.4 | dApp Store submitted | Native wallet complete | Seed Vault stub (pending native module)
**Positioning:** Privacy in Your Pocket — consumers, daily use, native security
**Companion:** sip-app ("Privacy Command Center" — enterprise, compliance, power users)
