# tabone ⚡
> **Instant, private multi-tab bridge from your computer to your phone.**  
> Beam all your active browser tabs into a single QR code. Zero logins, zero cloud tracking, ad/tracker-stripped, and 100% free forever.

---

## 🌟 Why tabone?

* **No Account Sync Needed:** Perfect for separating your work/school PC from your personal phone. No need to log into the same Google, Apple, or Microsoft accounts across devices.
* **1-Click Batch Capture:** Grab every open tab in your current browser window with one click.
* **100% Free & Zero-Leak Serverless:** Your links are compressed directly into the QR code's URL hashtag (`#`). The hosting server never sees, saves, or stores your tabs.
* **Privacy Tracker Stripper:** Automatically removes tracking tags (`utm_source`, `fbclid`, `si`, `gclid`, `ttclid`, Amazon `ref_`, etc.) to protect your privacy and reduce QR code size.
* **Bitdefender-Style Threat Scanner:** Analyzes links for suspicious lookalike domains, raw IP addresses, and unencrypted HTTP to protect your personal phone before opening links.
* **Configurable QR Density (V18 vs. V35):** Choose **Version 18** (chunky blocks for older phone cameras) or **Version 35** (high capacity for modern cameras).
* **Local History Vault:** Revisit yesterday's or last week's tabs anytime directly on your phone, stored privately in your phone's memory (`localStorage`).
* **Safe PC Tab Closer:** Optional toggle to close your PC tabs and free up computer RAM after scanning (strictly **OFF by default** to protect your unsaved work).
* **Military-Grade PIN Encryption:** Optional AES-256-GCM encryption so nobody can shoulder-surf your screen in coffee shops or offices.

---

## 🚀 Easy Download & Installation (3 Steps)

### Step 1: Download tabone
* Download **[`tabone-extension-v1.0.0.zip`](dist/tabone-extension-v1.0.0.zip)** from the `dist/` folder or GitHub Releases.
* Extract the `.zip` file into a folder on your computer.

### Step 2: Install into Your Browser (Chrome / Edge / Brave)
1. Open your browser and navigate to:
   * **Chrome / Brave:** `chrome://extensions/`
   * **Edge:** `edge://extensions/`
2. Turn **ON** the **Developer mode** toggle (top-right corner).
3. Click the **"Load unpacked"** button (top-left).
4. Select the extracted folder containing `manifest.json`.
5. Pin the **tabone** icon to your browser toolbar!

### Step 3: Scan with Your Phone!
Whenever you want to beam your tabs:
1. Click the **tabone** icon in your browser toolbar.
2. Select which tabs you want to include (or click "All").
3. Point your phone camera at the screen and tap the link!

---

## 📱 Mobile Hub Hosting Options ($0 Cost)

Your phone needs a webpage to open the tab list. Choose whichever method fits your workflow:

### Option A: Local Wi-Fi (Instant — Zero Internet Setup)
1. In your `tabone` folder, double-click **`start_wifi_hub.bat`**.
2. It automatically starts a lightweight local server and displays your local Wi-Fi URL (e.g. `http://192.168.0.103:8080/web/`).
3. In the extension Settings (⚙️), click **Local Wi-Fi**.
4. Scan and view your tabs instantly on your local home or office network!

### Option B: Free GitHub Pages (Cloud Access Anywhere)
1. Upload the `web/` folder to your GitHub repository.
2. Go to **Settings** > **Pages** > select branch `main` and click **Save**.
3. Paste your GitHub Pages URL into the extension Settings once. It is saved forever!

---

## ⚙️ Settings & Customization

| Setting | Options | What it Does |
| :--- | :--- | :--- |
| **QR Version** | `Version 18` (89×89) or `Version 35` (157×157) | V18 has large, chunky blocks for older cameras. V35 holds up to 24+ tabs for modern cameras. |
| **Error Correction** | `L (7%)`, `M (15%)`, `Q (25%)`, `H (30%)` | Adjusts damage & glare recovery. Level M is the recommended balanced standard. |
| **Safe Tab Capacity** | Live real-time counter | Shows safe tab capacity with an enforced 15% safety buffer so you never overflow the QR grid. |
| **PIN Encryption** | 4 to 6 digit numeric code | Encrypts your tabs with AES-256-GCM before generating the QR code. Must be unlocked on your phone. |
| **Close PC Tabs** | Toggle (Default: OFF) | Closes scanned tabs on your PC to free up RAM. |

---

## 🔒 Privacy & Zero-Leak Security Guarantee

* **Zero Cloud Databases:** No server or cloud database is used.
* **URL Hash Technology:** All tab data lives exclusively after the `#` fragment in the URL. Hash fragments are mathematically client-side only and are never transmitted across the network to hosting servers.
* **100% Offline Bundled:** All cryptographic (Web Crypto API) and QR generation libraries are bundled locally. Zero external CDN calls or analytics tracking.

---

## 📄 License
MIT License. Free and open source for everyone.
