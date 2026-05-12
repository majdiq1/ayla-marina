# Ayla Marina — Interactive Map

A premium, mobile-native interactive map for Ayla Marina Village in Aqaba, Jordan.

**Live demo:** https://majdiq1.github.io/ayla-marina/
**Analytics preview:** https://majdiq1.github.io/ayla-marina/dashboard.html

## Stack

- Plain HTML, CSS, vanilla JS — no framework, no build step
- Data: JSON files in `/data` (no database)
- PWA-ready, installable, works offline after first load
- Hosts on any static server (GitHub Pages, Vercel, Netlify, nginx, Apache)

## What's included

- 2 levels (Ground + Marina) with 55 real businesses
- Pinch / zoom / pan with momentum
- Category filters, search, deep-linking
- Bottom-sheet POI detail with Directions / Call / WhatsApp / Instagram / Share
- Animated water + drifting boats, sequential pin entry
- Auto-zoom to filter bounds, compass, +/- controls, dynamic scale bar
- Desktop split view with synced list + map hover
- Analytics dashboard mockup

## Run locally

```bash
python3 -m http.server 8787
open http://localhost:8787/
```

## Brand

Built to Ayla Oasis's identity:
- Aqua `#3AB0C8` (extracted from their live CSS)
- Cream `#FAF7F3`
- Charcoal `#3E3E3E`
- Playfair Display + Inter
