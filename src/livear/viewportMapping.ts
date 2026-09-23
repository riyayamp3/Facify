/**
 * "object-fit: contain" placement of a video inside a container — scales
 * the video to fit without cropping, centered, letterboxed on one axis.
 * No-crop (vs. "cover") means normalized video coordinates map to the
 * displayed rect with a single scale + offset, no inverse-crop math needed.
 */
export interface DisplayRect {
  offsetX: number
  offsetY: number
  width: number
  height: number
}

export function computeContainRect(
  container: { width: number; height: number },
  video: { width: number; height: number },
): DisplayRect {
  if (video.width === 0 || video.height === 0) {
    return { offsetX: 0, offsetY: 0, width: container.width, height: container.height }
  }
  const scale = Math.min(container.width / video.width, container.height / video.height)
  const width = video.width * scale
  const height = video.height * scale
  return {
    offsetX: (container.width - width) / 2,
    offsetY: (container.height - height) / 2,
    width,
    height,
  }
}

/** Maps a normalized ([0,1], y-down) video coordinate to viewport pixels. */
export function videoNormToViewport(
  p: { x: number; y: number },
  rect: DisplayRect,
): { x: number; y: number } {
  return { x: rect.offsetX + p.x * rect.width, y: rect.offsetY + p.y * rect.height }
}

/** Inverse of videoNormToViewport — used to map a pointer/click back to normalized video space. */
export function viewportToVideoNorm(
  p: { x: number; y: number },
  rect: DisplayRect,
): { x: number; y: number } {
  return { x: (p.x - rect.offsetX) / rect.width, y: (p.y - rect.offsetY) / rect.height }
}

/**
 * Screen-pixel (top-left origin, y-down) to Three.js world space, for R3F's
 * default orthographic camera, which auto-sizes its frustum centered on
 * (0,0) — [-width/2, width/2] x [-height/2, height/2] — rather than
 * top-left-origin. Fighting that default with a custom camera turned out
 * more fragile than just converting into the convention it already uses.
 */
export function screenToWorld(
  p: { x: number; y: number },
  container: { width: number; height: number },
): { x: number; y: number } {
  return { x: p.x - container.width / 2, y: container.height / 2 - p.y }
}

/**
 * The full metric-space -> world-space transform, as a single affine
 * scale+offset per axis — derived by composing metricToImageLandmarks,
 * videoNormToViewport and screenToWorld (all linear/affine), so the shader
 * can invert it directly (world -> metric) without walking each step.
 * world = metric * scale + const.
 */
export function computeMetricToWorld(
  rect: DisplayRect,
  container: { width: number; height: number },
  aspect: number,
): { scale: { x: number; y: number }; offset: { x: number; y: number } } {
  return {
    scale: { x: rect.width / aspect, y: rect.height },
    offset: {
      x: rect.offsetX + 0.5 * rect.width - container.width / 2,
      y: container.height / 2 - rect.offsetY - 0.5 * rect.height,
    },
  }
}
