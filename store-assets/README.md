# SIP Privacy - Solana dApp Store Assets

Store assets for publishing SIP Privacy to the Solana dApp Store (Seeker).

## Requirements

Based on [Solana Mobile Docs](https://docs.solanamobile.com/dapp-publishing/prepare):

### Icons (Required)
| Asset | Size | Status |
|-------|------|--------|
| App Icon | 512x512px | ✅ `icons/app-icon-512.png` |
| Publisher Icon | 512x512px | ✅ `icons/publisher-icon-512.png` |

### Banner (Required)
| Asset | Size | Status |
|-------|------|--------|
| Banner Graphic | 1200x600px | ✅ `banners/banner-1200x600.png` |
| Feature Graphic | 1200x1200px | Optional (for Editor's Choice) |

### Screenshots (Minimum 4 Required)
All screenshots: 1920x1080px (landscape) or 1080x1920px (portrait)

| # | Screen | Status |
|---|--------|--------|
| 1 | Home Dashboard | ⏳ `screenshots/01-home-dashboard.png` |
| 2 | Send Private Payment | ⏳ `screenshots/02-send-private.png` |
| 3 | Receive with Stealth Address | ⏳ `screenshots/03-receive-stealth.png` |
| 4 | Swap with Privacy Toggle | ⏳ `screenshots/04-swap-privacy.png` |
| 5 | Compliance Dashboard | ⏳ `screenshots/05-compliance-audit.png` |

## Screenshot Guidelines

### Visual Style
- Dark theme (#0A0A0A background)
- SIP teal accent (#14B8A6)
- Clean device frame mockup
- Consistent 1920x1080px landscape orientation

### Content Requirements per Screenshot

**01-home-dashboard.png**
- Shows wallet balance
- Recent transactions
- Quick action buttons (Send, Receive, Swap)
- Privacy score indicator

**02-send-private.png**
- Amount input field
- Recipient address field
- Privacy toggle (enabled, highlighted)
- "Shielded Transfer" label visible

**03-receive-stealth.png**
- Stealth address displayed
- QR code prominently shown
- Copy address button
- "One-time address" explanation

**04-swap-privacy.png**
- Token pair selector
- Swap amount input
- Privacy toggle (enabled)
- Jupiter quote/price impact shown

**05-compliance-audit.png**
- Privacy score display
- Audit trail events
- Viewing key export option
- Disclosure management

## Banner Guidelines

**banner-1200x600.png**
- SIP shield logo centered
- "SIP Privacy" text
- Tagline: "Private Payments on Solana"
- Dark navy background (#0A0F1A)
- Teal accent elements

## Directory Structure

```
store-assets/
├── config.yaml          # Solana dApp Store config
├── README.md            # This file
├── icons/
│   ├── app-icon-512.png       ✅
│   └── publisher-icon-512.png ✅
├── banners/
│   └── banner-1200x600.png    ⏳
└── screenshots/
    ├── 01-home-dashboard.png  ⏳
    ├── 02-send-private.png    ⏳
    ├── 03-receive-stealth.png ⏳
    ├── 04-swap-privacy.png    ⏳
    └── 05-compliance-audit.png ⏳
```

## Publishing Commands

```bash
# Install dApp publishing CLI
npm install -g @solana-mobile/dapp-store-cli

# Validate config
dapp-store validate --config store-assets/config.yaml

# Create NFTs and submit
dapp-store publish --config store-assets/config.yaml
```

## References

- [Solana dApp Store Docs](https://docs.solanamobile.com/dapp-publishing/intro)
- [Listing Page Guidelines](https://docs.solanamobile.com/dapp-publishing/listing-page-guidelines)
- [dApp Publishing CLI](https://github.com/solana-mobile/dapp-publishing)
