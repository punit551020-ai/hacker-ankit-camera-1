# Hacker Ankit Camera

Offline-first Pro 8K Camera & Unlimited Video Recorder PWA built with React, Vite, Workbox Service Worker, local MediaPipe Vision AI, and Canvas2D optics. Works across **iPhone, Android, MacBook, and Windows/Linux**.

## Key Features
- **100% Offline App (PWA)**: Installs directly to iPhone, Android, MacBook Dock, and Desktop with a custom optical lens Home Screen icon and runs offline without internet or SIM. Once opened from Home Screen, the **Install App** option automatically hides.
- **Real Device Camera & Direct Gallery Saving**: Saves real `.jpg` (`HD / 2K / 4K / 6K / 8K`) and unlimited `.webm`/`.mp4` video files directly to device Downloads, IndexedDB Vault, native Share Sheet (Apple Photos / Instagram Story / WhatsApp / YouTube), and optional synced Pictures folder.
- **Pro Filters & Quality Rescue**: DSLR Clarity, Low-Light Fix, Pure White, Skin Glow Pro, HDR Ultra, B&W Leica Noir, Teal & Orange, and more, plus Shadow Recovery, Warmth, Exposure, Contrast, Sharpness, and Auto HD Clarity.
- **35 Offline Backdrops & Head-Tracked AR Overlays**: On-device background cutout + 35 offline scenes (Burj Khalifa, Mega Waterfall, Taj Mahal, Paris, Hacker Ankit Cyber Room, Space, Supercars, etc.) plus Hair-Top **Name Crown** (`Hacker Ankit` + live editable name + 5 movement styles), Realistic Fire Aura, Royal Crown, Floating Hearts, and Eye-Tracked Cyber Shades.

## Publish to GitHub Pages
This repository includes `.github/workflows/deploy.yml`, which automatically builds the offline PWA (`VITE_BASE_PATH=./`) and deploys it to GitHub Pages whenever you push to `main`.

```bash
git init -b main
git add .
git commit -m "Hacker Ankit Camera offline PWA"
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/hacker-ankit-camera.git
git push -u origin main
```

Then in your GitHub repository: **Settings → Pages → Source → GitHub Actions**.

## Local Development
```bash
npm install
npm run dev
```

## Production Build
```bash
npm run build
npm start
```
