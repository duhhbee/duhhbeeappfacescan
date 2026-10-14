# DuhhBee face scan (WebView)

Vite + React app loaded inside the DuhhBee mobile app WebView for register face scanning (MediaPipe face mesh, quality gates, yellow frame overlay).

## Scripts

```bash
npm install
npm run dev      # local dev server
npm run build    # production bundle → dist/
```

## Deploy

Ship `dist/` to Vercel (or similar) and set the app env:

`EXPO_PUBLIC_FACESCAN_URL=https://your-deployment.vercel.app`

See **duhhbee-app** `docs/FACESCAN_DEPLOY.md` for HTTPS on device, pose injection contract, and QA checklist.

## Key files

| File | Role |
|------|------|
| `src/faceQuality.js` | Lighting, blur, yaw pose checks (center / left / right) |
| `src/components/FaceMesh.jsx` | Camera + mesh + postMessage to RN |
| `src/components/FaceScanOverlay.jsx` | Yellow guide frame |

Pose is set by the app: `window.__duhhPose = 'center' | 'left' | 'right'`.
