import { Html, Line } from '@react-three/drei'
import type { LineMeasurement } from '../analysis/measurements'
import { distance, midpoint } from '../math/vec3'

const EPSILON = 1e-5

interface MeasurementOverlayProps {
  measurement: LineMeasurement
}

/** Renders a measurement's line segments + value labels over the face mesh. */
export function MeasurementOverlay({ measurement }: MeasurementOverlayProps) {
  return (
    <group>
      {measurement.segments.map((seg, i) => {
        const isPoint = distance(seg.from, seg.to) < EPSILON
        const mid = midpoint(seg.from, seg.to)
        return (
          <group key={i}>
            {!isPoint && (
              <Line
                points={[
                  [seg.from.x, seg.from.y, seg.from.z],
                  [seg.to.x, seg.to.y, seg.to.z],
                ]}
                color="#c9a55c"
                lineWidth={1.5}
                dashed={false}
              />
            )}
            <mesh position={[seg.to.x, seg.to.y, seg.to.z]}>
              <sphereGeometry args={[0.006, 8, 8]} />
              <meshBasicMaterial color="#c9a55c" />
            </mesh>
            {seg.label && (
              <Html position={[mid.x, mid.y, mid.z]} center distanceFactor={2.2} zIndexRange={[10, 0]}>
                <div className="whitespace-nowrap rounded-sm border border-workstation-accent/50 bg-workstation-bg/90 px-1.5 py-0.5 text-[10px] text-workstation-accent">
                  {seg.label}
                </div>
              </Html>
            )}
          </group>
        )
      })}
    </group>
  )
}
