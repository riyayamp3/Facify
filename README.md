# Faceify Labs

A real-time facial deformation system that uses the same anatomical deformation model to drive both a 3D face and a live camera feed.
It has two modes:

- **Live AR** — applies aesthetic procedures to your live camera feed in real time, with no scan required.
- **3D Playground** — scan your face once (front, left, right) to build a 3D model, then run measurements and simulate procedures on it at your own pace.

> **Not a medical tool.** Procedure simulations are visual previews. Where no clinical reference exists, controls are a 0–100% preview rather than a calibrated measurement, and the UI says so. Do not use this to make medical decisions.

## Procedures

| Procedure | Notes |
|---|---|
| Buccal Fat Removal | Slider in cc, calibrated against reference pad-volume data and capped at the conservative 50% rule (`src/anatomy/buccalFatData.ts`). |
| Lip Lift | Bullhorn (subnasal), Corner, and Direct techniques as independent sliders. |
| Dimpleplasty | Starts at the Khoo Boo-Chai point; click a cheek to reposition. In Live AR, depth scales with detected smile intensity, since real dimples only show when the buccinator contracts. |
| Endoscopic Brow Lift | Lateral and Medial zones per side, each independent. |
| Hairline Lowering | Central and per-side Temporal. MediaPipe has no hair geometry, so this advances the visible forehead-skin boundary as a proxy. |

## Analysis (3D Playground)

Ten measurements computed from the scanned landmarks: Facial Thirds, Five-Eye Ratio, Depth, Contour Line, Side Face Angle, Lifting Angle, Nasal Tip Projection, E-Line, Lip-Chin Ratio, Lip Ratio. There is no metric camera calibration, so values without a real formula source are shown as ratios or relative numbers, never fabricated millimetres.

## Getting started

Requires Node.js and a webcam.

```bash
npm install
npm run dev
```

Open the printed local URL and allow camera access.

Other scripts:

```bash
npm run build     # type-check (tsc -b) and production build
npm run preview   # serve the production build
npm run lint      # oxlint
```

MediaPipe's WASM runtime and face-landmarker model are fetched from a CDN at startup, so the first load needs an internet connection.

## Tech stack

Vite, React 19, TypeScript, Tailwind CSS v4, Three.js via `@react-three/fiber` / `drei`, and MediaPipe FaceLandmarker (`@mediapipe/tasks-vision`) for 468-point face tracking.

## How it works

**Tracking** — `src/tracking/useFaceLandmarker.ts` runs MediaPipe on every animation frame and exposes the latest landmarks through a ref, so the tracking loop never triggers a React re-render.

**Deformation** — every procedure is described as a list of *zones* (`getDeformationZones` in `src/simulation/deformFace.ts`): anchor points, a magnitude, a radius, and a direction. That single description feeds both renderers, so a slider means the same thing in both modes:

- **3D Playground** displaces mesh vertices on the CPU (`src/deformation/radialField.ts`).
- **Live AR** evaluates the same math per pixel in a fragment shader (`src/livear/warpShader.ts`), solving a backward-mapped warp by fixed-point iteration. This replaced an earlier triangle-mesh warp, whose coarse 468-triangle mesh visibly streaked under steep deformation gradients.

**Live AR specifics**

- *Scale invariance* — radius and magnitude scale with the live interocular distance, so effects stay proportional as you move toward or away from the camera.
- *Smoothing* — landmarks pass through a One Euro Filter (`oneEuroFilter.ts`): heavy smoothing when still, light smoothing when moving, to balance jitter against lag.
- *Face-anchored points* — a clicked dimple is attached to the nearest landmark plus a scale-normalised offset, so it follows head movement and camera distance (`faceAnchoredPoint.ts`).
- *Smile detection* — mouth width relative to a rolling neutral baseline drives dimple depth (`smileTracker.ts`).
- *Shading* — a pixel warp has no lighting model, so recessing procedures (dimple, buccal fat) get a subtle darkening scaled by their live depth to read as a hollow rather than a flat pucker.
- *Robust anchors* — Hairline anchors are derived from glabella and the outer eye corner (scaled by interocular distance) rather than read from landmarks at the very edge of MediaPipe's tracked region, which are the first to be cropped or occluded by hair.

## Project layout

```
src/
  anatomy/       landmark groups, region definitions, clinical reference data
  analysis/      the 10 measurements and the analysis rail UI
  camera/        camera access hook
  deformation/   radial falloff math (CPU path)
  livear/        Live AR: shader warp, smoothing, smile tracker, viewport mapping
  math/          vectors, head pose, canonical (pose-corrected) space
  model/         3D face model construction
  render/        3D viewer, camera rig, measurement overlays
  scan/          guided front/left/right scan flow
  simulation/    procedure controls, sidebar, shared deformation zones
  tracking/      MediaPipe FaceLandmarker hook
```

## Known limitations

- Tuned constants (falloff radii, magnitudes, shadow strength, smoothing parameters) are reasoned starting points refined from real-camera feedback, not lab-measured optima. Expect further tuning.
- Pixel-warp reshaping distorts fine, high-frequency texture such as eyebrow hair and cannot reproduce true 3D tissue motion. For example, Lip Lift can move the vermilion border but cannot roll it outward the way a real bullhorn lift everts the lip.
- Quality depends heavily on lighting and camera angle; extreme head poses degrade tracking.
