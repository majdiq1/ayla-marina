# Ayla Marina Village — Interactive Map Platform
### Client Handover Guide & User Manual

---

## 1. The Project at a Glance

You now own a fully interactive map platform that replaces the static marina map with a premium, mobile-native experience. It runs entirely in the browser — no servers to maintain, no databases to back up — and the admin console lets you manage every place, category, photo, and brand element without touching a line of code.

**Live URL:** `https://ayla.actual.business/`
**Admin Console:** `https://ayla.actual.business/admin.html`
**Pitch / Proposal Deck:** `https://ayla.actual.business/pitch.html`

**Three map concepts a visitor can switch between:**
1. **Illustrated** — your original hand-drawn marina map
2. **Satellite** — real-world satellite imagery (Esri World Imagery)
3. **Ayla Premium** — AI-rendered architectural visualization

Each place pin carries its own logo, sits on the right floor (Ground · Marina), and links to phone, WhatsApp, Instagram, and Google Maps directions.

---

## 2. First-Time Sign-In

1. Open `https://ayla.actual.business/admin.html`
2. Default password (demo): `ayla2026`
3. **Change the password immediately** — Settings → Security → fill in the three password fields → "Change password". The demo hint disappears the moment a new password is saved.

> Tip: Your changes are stored privately in your browser. They are not visible to visitors until the developer publishes them to the live site, OR you can use the admin from the same device every time and your edits will persist there.

---

## 3. The Admin Console — A Tour

The admin has four sections, accessible from the top tab bar:

| Tab | What it controls |
|-----|------------------|
| **Places** | All 55+ shops, dining, hotels, experiences pinned on the maps |
| **Categories** | The 9 color-coded categories (Cafe, Hotels, Shopping, etc.) |
| **Settings** | Brand identity, theme colors, fonts, maps, security |
| **Support** | Direct contact lines to the developer (WhatsApp, phone, email) |

A persistent header at the very top has:
- **Ayla Marina** wordmark — the project's identity (changeable in Settings)
- **Public Map · Admin · Proposal** quick links — jump between the visitor view, this console, and the pitch deck
- **Logout** icon — top-right corner

---

## 4. Managing Places

### Browsing places
Open the **Places** tab. By default, places are grouped by category, each section has its own coloured rule, the Arabic name, and the count. Switch to "A–Z" mode using the pill at the top if you prefer alphabetical browsing.

The search bar narrows the list as you type. Category and Level dropdowns filter the visible places further.

### Adding a new place
1. Click **+ New place** (top right of the Places page)
2. Fill in the three accordion steps — only one is open at a time so you can focus

**Step 01 — Identity**
- Name (English) — required
- Name (Arabic) — optional, displayed when the visitor's device is set to Arabic
- Category — required; picks the pin color
- Level — required; Ground or Marina
- Logo — required for the best experience. Upload a square PNG/JPG and use the in-place cropper (drag, zoom slider) to frame it perfectly inside the pin. A live preview teardrop on the right shows exactly how it will land on the map.

**Step 02 — Contact**
- Phone, WhatsApp, Instagram — visitors get one-tap buttons
- Google Maps URL — paste any Google Maps share link; the latitude and longitude auto-fill (GPS is detected). If you prefer, type lat / lng manually below

**Step 03 — About**
- Description (English + Arabic) — short sentence visitors see in the place sheet
- Active (visible on public map) — uncheck to hide a place without deleting it

### Placing the pin on the maps
The left half of the edit page is a live map. Three concept pills (Illustrated · Premium · Satellite) and two level pills (Ground · Marina) drive what's shown:
- **Illustrated** — click anywhere on the hand-drawn map to drop the pin
- **Premium** — same, on the AI-rendered map (positions are stored separately so each map can be tuned independently)
- **Satellite** — click on real-world satellite imagery to lock GPS coordinates; this is the most precise for "Directions" links

Once placed, you can drag the pin to fine-tune. Other places on the same floor appear as small dimmed dots so you can position by reference.

### Saving
The sticky bar at the bottom of the page has **Delete · Cancel · Save changes** — always within reach. Save commits your edits to the place.

---

## 5. Managing Categories

Open the **Categories** tab.

Each category card carries:
- Its own subtle tint of the category color (5% wash)
- Pin icon + name (EN + Arabic) + place count
- Place list — first 5 places + "more" indicator

Click any card to edit. The edit page is a single panel with:
- Name (English & Arabic)
- URL slug — short identifier, lowercase no spaces (e.g. `cafe`)
- Pin colour — color picker + hex code. This colour propagates to every pin in this category instantly.
- Sort order — controls the order categories appear in filters and the categories grid (lower = first)

To add a new category, click **+ New category** at the top right.

---

## 6. Settings — Brand, Theme, Maps, Security

Settings has three sub-tabs running across the top.

### Brand & Theme

**Brand panel:**
- **Brand name (English / Arabic)** — drives every place that says "Ayla Marina" on the public site (splash, topbar, browser tab title)
- **Splash tagline** — small text below the logo on the loading splash
- **Brand logo** — upload a square or wide logo (SVG / PNG with transparency works best). Replaces the default mark on the splash AND in the persistent topbar. Once uploaded, the redundant "Marina Village" subtitle on the splash is auto-hidden.
- **Brand title preview** — live preview of how the wordmark renders below
- **Font size (px)** — controls the wordmark size
- **Base colour** — colour of the non-italic word (e.g. "Marina")
- **Accent colour** — colour of the italic word (e.g. "Village")

**Theme panel:**
- **Primary brand colour** — drives the entire app's accent tone: concept switcher highlights, focus rings, the splash gradient, the admin login screen, and more
- **Upload your own fonts** — drop in `.woff2` / `.woff` / `.ttf` / `.otf` for both heading and body. The site will use them across the entire public experience.

### Maps

**Map concepts**
- Toggle each concept on/off — hidden concepts disappear from the visitor's concept switcher
- Default concept — which one visitors land on when they first open the map

**Custom map images**
- Pick a concept (Illustrated / Premium) and a level (Ground / Marina) with the pill tabs at the top
- Two tiles below show the current Desktop and Phone versions — each labeled **Default · Bundled** or **Custom upload** so you know what's in play
- Upload swaps the bundled image for your own. The map preview reflects immediately. Up to 8 unique images total (2 concepts × 2 levels × 2 device sizes).

### Security
Change the admin password. It is stored as a SHA-256 hash; the demo hint disappears the moment a new password is set.

**Save settings** (top right) commits all the Brand & Theme + Map concepts toggle changes. (Uploaded images and font files auto-save on upload.)

---

## 7. Support

The **Support** tab gives you three direct lines to the developer (Majdi):

- **WhatsApp** (fastest) — `+962 79 200 0126` (tap → opens WhatsApp with a pre-filled "I need help with the Ayla Marina admin" message)
- **Phone** — same number, traditional dial
- **Email** — `majdi@majdialqudah.com`

Reply time during business hours is typically under an hour.

---

## 8. How Your Changes Reach Visitors

Right now, every edit you make is stored in your browser's local storage. Visitors see the version your developer last published.

**If you want changes pushed live:**
- Use the WhatsApp/email contact in Support and request a publish
- Or, if you've been given a deployment shortcut, follow the developer's instructions for it

Future versions can include a one-click **Publish** button — ask the developer if you'd like that wired up.

---

## 9. Backups & Data Safety

- All map data (`pois.json`, `categories.json`, `levels.json`, `settings.json`) lives in this project's `data/` folder, stored in a private GitHub repo (`majdiq1/ayla-marina`)
- The site itself is hosted on **GitHub Pages**, served via a Cloudflare DNS record pointing `ayla.actual.business` at GitHub's edge — no servers to maintain, no monthly hosting bills
- Your localStorage admin edits travel with the device. If you switch to a new device, the developer can export and import them so you don't lose work.

---

## 10. Recommended Workflows

### When a new shop opens
1. Sign in to the admin
2. Places → + New place
3. Fill name, category, level, logo (cropped via the in-place cropper)
4. Contact tab → paste the shop's Google Maps share link → GPS auto-fills
5. Switch to Satellite tab on the map → click the exact storefront → Save
6. Repeat for each new tenant — usually 90 seconds per place once you're warmed up

### When a shop closes
- Find the place in Places list → click → uncheck "Active" → Save. The pin disappears for visitors instantly while the data stays in case the spot returns.

### When you want to rebrand seasonally (e.g. holiday colours)
- Settings → Brand & Theme → tweak the Primary brand colour + accent + maybe a different heading font upload → Save settings.

### Adding a new category
- Categories → + New category → pick a colour from any 6-digit hex code → save. All future places can be assigned to it.

---

## 11. Technical Footnotes

For the curious developer or future maintainer:

- **Stack:** vanilla HTML/CSS/JavaScript, no framework — fast load, zero build step
- **Tile provider:** Esri World Imagery (free, no API key)
- **Pin rendering:** Leaflet for satellite, custom SVG/CSS pin layer for illustrated and premium concepts
- **Mobile-native:** safe-area insets respected, native iOS/Android-style sheet drag-dismiss, springy transitions, drag-pan map
- **PWA-ready** — can be installed to home screen on iOS/Android
- **Offline-tolerant:** map images cached, place data fetched once and merged with localStorage overrides
- **Repo:** `https://github.com/majdiq1/ayla-marina`
- **Hosting:** GitHub Pages, free, no daily caps
- **DNS:** Cloudflare zone `actual.business`, CNAME `ayla → majdiq1.github.io`

---

## 12. Project Credits

Built and maintained by **Majdi Alqudah** of **مؤسسة ثلاثمائة وواحد وستون درجة**.

- Personal site: [majdialqudah.com](https://majdialqudah.com)
- WhatsApp: [wa.me/962792000126](https://wa.me/962792000126)
- Email: [majdi@majdialqudah.com](mailto:majdi@majdialqudah.com)

---

*Document version 1.0 — 2026-05-19*
