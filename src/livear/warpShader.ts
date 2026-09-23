import * as THREE from 'three'
import type { DeformationZone } from '../simulation/deformFace'

// Matches the real max simultaneously-active regions/points across all 5
// procedures (buccal = 4 zones max, brow lift's merged Lateral+Medial arc
// and lip-direct both = 10 points max) — a tight fit, not a generous
// guess; bump both if a future procedure needs more.
export const MAX_ZONES = 4
export const MAX_POINTS = 10

/**
 * Per-pixel dense warp field, evaluated directly in the fragment shader
 * instead of interpolated across MediaPipe's sparse 468-triangle mesh.
 * The radial-falloff math here is a line-for-line port of
 * deformation/radialField.ts (smoothFalloff, distance-to-segment) — same
 * calibrated magnitudes/radii, just evaluated continuously instead of at
 * 468 sample points, which is what a triangle-based warp fundamentally
 * can't do (a coarse triangle spanning a falloff's steep part gets
 * visibly stretched — that's the "glassy streak" artifact this replaces).
 *
 * Backward mapping: for each destination pixel, solve dest = source +
 * displacement(source) for `source` by fixed-point iteration (source ≈
 * dest, then repeatedly source = dest - displacement(source)) rather than
 * the cheaper one-step displacement(dest) ≈ displacement(source). Exact at
 * the field's fixed point; the one-step version's error grows with the
 * local gradient of the field, which is largest exactly at a falloff's
 * steep edge — the same spot the old triangle warp streaked at. Five
 * iterations hold up even for a magnitude/radius ratio as steep as
 * Hairline Lowering's (needs real reach to visibly pull hair into frame,
 * not just nudge skin) while staying trivially cheap per-pixel.
 *
 * Shadow: a pure pixel-resample warp has no lighting model, so a "pit"
 * (dimpleplasty, buccal fat) reads as a gentle pucker rather than a real
 * dimple's crisp, shadowed concavity — real dimples read almost entirely
 * from the shadow their concave surface casts, not the displacement
 * alone. Each zone's `shadowStrength` (0 for elevation-type procedures)
 * darkens the sampled color proportional to its own falloff weight —
 * simple and symmetric, not a directional/physically-lit shadow (that
 * would need a real lighting direction we don't have), but enough to read
 * as "a real hollow" instead of "warped but flat" skin.
 */
const vertexShader = /* glsl */ `
varying vec2 vWorldPos;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPosition.xy;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`

const fragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D map;
uniform int uZoneCount;
uniform int uPointCount[${MAX_ZONES}];
uniform int uIsPath[${MAX_ZONES}];
uniform vec2 uDirection[${MAX_ZONES}];
uniform float uMagnitude[${MAX_ZONES}];
uniform float uRadius[${MAX_ZONES}];
uniform float uShadowStrength[${MAX_ZONES}];
uniform vec2 uPoints[${MAX_ZONES * MAX_POINTS}];
// Per-point magnitude override (see DeformationZone.pointMagnitudes) — for
// most zones this is just uMagnitude[zi] repeated, but brow lift's merged
// Lateral+Medial zone needs each point able to carry its own amount.
uniform float uPointMagnitude[${MAX_ZONES * MAX_POINTS}];
uniform vec2 uMetricScale;
uniform vec2 uMetricConst;
uniform float uAspect;

varying vec2 vWorldPos;

// Quintic smootherstep (Perlin) — see radialField.ts's smoothFalloff for
// why this replaced cubic smoothstep (zero second derivative at the edges
// too, so real skin/hair texture doesn't show a faint ring at the boundary).
float smoothFalloff(float d, float radius) {
  if (d >= radius) return 0.0;
  float t = 1.0 - d / radius;
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

// .xy = displacement, .z = shadow (sum of shadowStrength*weight across zones).
vec3 computeDisplacementAndShadow(vec2 p) {
  vec2 displacement = vec2(0.0);
  float shadow = 0.0;

  for (int zi = 0; zi < ${MAX_ZONES}; zi++) {
    if (zi >= uZoneCount) break;
    int count = uPointCount[zi];

    if (uIsPath[zi] == 1) {
      // Nearest point on the nearest SEGMENT, same as
      // applyRadialDeformationPathWeighted — a path has no per-point
      // seams by construction, unlike discrete point-falloff (two earlier
      // attempts at brow lift used that instead and each left a visible
      // artifact; see this zone's uPointMagnitude comment and
      // applyRadialDeformationPathWeighted's doc for the full history).
      // The winning segment's own two endpoint magnitudes are
      // interpolated by the same t the distance itself used, so
      // magnitude and position vary together, smoothly, along one line.
      float minDist = 1.0e6;
      float segMagnitude = uPointMagnitude[zi * ${MAX_POINTS}];
      for (int pi = 0; pi < ${MAX_POINTS - 1}; pi++) {
        if (pi >= count - 1) break;
        vec2 a = uPoints[zi * ${MAX_POINTS} + pi];
        vec2 b = uPoints[zi * ${MAX_POINTS} + pi + 1];
        vec2 ab = b - a;
        float abLenSq = dot(ab, ab);
        float t = abLenSq < 1.0e-12 ? 0.0 : clamp(dot(p - a, ab) / abLenSq, 0.0, 1.0);
        float d = distance(p, a + ab * t);
        if (d < minDist) {
          minDist = d;
          float magA = uPointMagnitude[zi * ${MAX_POINTS} + pi];
          float magB = uPointMagnitude[zi * ${MAX_POINTS} + pi + 1];
          segMagnitude = mix(magA, magB, t);
        }
      }
      float weight = smoothFalloff(minDist, uRadius[zi]);
      displacement += uDirection[zi] * segMagnitude * weight;
      shadow += uShadowStrength[zi] * weight;
    } else {
      // Non-path zones all share one magnitude across their points (no
      // zone currently sets pointMagnitudes on a non-path zone), so plain
      // max-weight * shared-magnitude is exact — see
      // applyRadialDeformationMulti's own comment for why max, not sum.
      float maxWeight = 0.0;
      for (int pi = 0; pi < ${MAX_POINTS}; pi++) {
        if (pi >= count) break;
        float d = distance(p, uPoints[zi * ${MAX_POINTS} + pi]);
        maxWeight = max(maxWeight, smoothFalloff(d, uRadius[zi]));
      }
      displacement += uDirection[zi] * uMagnitude[zi] * maxWeight;
      shadow += uShadowStrength[zi] * maxWeight;
    }
  }

  return vec3(displacement, shadow);
}

void main() {
  vec2 metric = (vWorldPos - uMetricConst) / uMetricScale;

  vec2 sourceMetric = metric;
  for (int iter = 0; iter < 5; iter++) {
    sourceMetric = metric - computeDisplacementAndShadow(sourceMetric).xy;
  }
  // Shadow is a property of the visible (destination) surface, not of
  // wherever the source pixel came from — evaluated separately at metric.
  float shadow = computeDisplacementAndShadow(metric).z;

  vec2 sourceImage = vec2(sourceMetric.x / uAspect + 0.5, -sourceMetric.y + 0.5);
  vec4 texColor = texture2D(map, vec2(sourceImage.x, 1.0 - sourceImage.y));
  texColor.rgb *= (1.0 - clamp(shadow, 0.0, 0.6));
  gl_FragColor = texColor;
}
`

export function createWarpMaterial(map: THREE.Texture): THREE.ShaderMaterial {
  const points: THREE.Vector2[] = []
  for (let i = 0; i < MAX_ZONES * MAX_POINTS; i++) points.push(new THREE.Vector2())
  const direction: THREE.Vector2[] = []
  for (let i = 0; i < MAX_ZONES; i++) direction.push(new THREE.Vector2())

  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map },
      uZoneCount: { value: 0 },
      uPointCount: { value: new Array(MAX_ZONES).fill(0) },
      uIsPath: { value: new Array(MAX_ZONES).fill(0) },
      uDirection: { value: direction },
      uMagnitude: { value: new Array(MAX_ZONES).fill(0) },
      uRadius: { value: new Array(MAX_ZONES).fill(0.01) },
      uShadowStrength: { value: new Array(MAX_ZONES).fill(0) },
      uPoints: { value: points },
      uPointMagnitude: { value: new Array(MAX_ZONES * MAX_POINTS).fill(0) },
      uMetricScale: { value: new THREE.Vector2(1, 1) },
      uMetricConst: { value: new THREE.Vector2(0, 0) },
      uAspect: { value: 1 },
    },
    vertexShader,
    fragmentShader,
  })
}

/** Mutates an existing warp material's uniforms in place — called every
 * frame, so this avoids allocating (unlike the old per-frame BufferGeometry
 * rebuild it replaces). */
export function updateWarpUniforms(
  material: THREE.ShaderMaterial,
  zones: DeformationZone[],
  metricScale: { x: number; y: number },
  metricConst: { x: number; y: number },
  aspect: number,
) {
  const u = material.uniforms
  const zoneCount = Math.min(zones.length, MAX_ZONES)
  u.uZoneCount.value = zoneCount

  const pointCountArr = u.uPointCount.value as number[]
  const isPathArr = u.uIsPath.value as number[]
  const directionArr = u.uDirection.value as THREE.Vector2[]
  const magnitudeArr = u.uMagnitude.value as number[]
  const radiusArr = u.uRadius.value as number[]
  const shadowStrengthArr = u.uShadowStrength.value as number[]
  const pointsArr = u.uPoints.value as THREE.Vector2[]
  const pointMagnitudeArr = u.uPointMagnitude.value as number[]

  for (let zi = 0; zi < zoneCount; zi++) {
    const zone = zones[zi]
    const count = Math.min(zone.points.length, MAX_POINTS)
    pointCountArr[zi] = count
    isPathArr[zi] = zone.isPath ? 1 : 0
    magnitudeArr[zi] = zone.magnitude
    radiusArr[zi] = zone.radius
    shadowStrengthArr[zi] = zone.shadowStrength
    const dirLen = Math.hypot(zone.direction.x, zone.direction.y) || 1
    directionArr[zi].set(zone.direction.x / dirLen, zone.direction.y / dirLen)
    for (let pi = 0; pi < count; pi++) {
      pointsArr[zi * MAX_POINTS + pi].set(zone.points[pi].x, zone.points[pi].y)
      // Zones without a per-point override just repeat their shared
      // magnitude — makes the shader's per-point path the only one it
      // needs (see computeDisplacementAndShadow).
      pointMagnitudeArr[zi * MAX_POINTS + pi] = zone.pointMagnitudes?.[pi] ?? zone.magnitude
    }
  }

  u.uMetricScale.value.set(metricScale.x, metricScale.y)
  u.uMetricConst.value.set(metricConst.x, metricConst.y)
  u.uAspect.value = aspect
}
