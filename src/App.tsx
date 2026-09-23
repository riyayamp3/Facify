import { useState } from 'react'
import { LiveArViewer } from './livear/LiveArViewer'
import { FaceViewer } from './render/FaceViewer'
import { ScanController } from './scan/ScanController'
import { SimulationViewer } from './simulation/SimulationViewer'
import type { FaceModel } from './types/face'

type Screen = 'mode-select' | 'live-ar' | 'scan' | 'viewer' | 'simulation'

export default function App() {
  const [screen, setScreen] = useState<Screen>('mode-select')
  const [faceModel, setFaceModel] = useState<FaceModel | null>(null)

  if (screen === 'mode-select') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-8 bg-workstation-bg px-6 text-workstation-text">
        <span className="text-sm font-medium tracking-[0.3em] text-workstation-muted">FACEIFY LABS</span>
        <h1 className="max-w-md text-center text-2xl font-light">
          A 3D facial analysis and aesthetic simulation workstation.
        </h1>

        <div className="flex w-full max-w-2xl flex-col gap-4 sm:flex-row">
          <button
            onClick={() => setScreen('live-ar')}
            className="flex flex-1 flex-col items-start gap-2 rounded-sm border border-workstation-border bg-workstation-panel px-6 py-5 text-left transition-colors hover:border-workstation-accent"
          >
            <span className="text-sm font-medium tracking-wide text-workstation-accent">Live AR</span>
            <span className="text-xs leading-relaxed text-workstation-muted">
              See every procedure applied live to your own camera feed in real time — no scan required.
            </span>
          </button>

          <button
            onClick={() => setScreen('scan')}
            className="flex flex-1 flex-col items-start gap-2 rounded-sm border border-workstation-border bg-workstation-panel px-6 py-5 text-left transition-colors hover:border-workstation-accent"
          >
            <span className="text-sm font-medium tracking-wide text-workstation-accent">3D Playground</span>
            <span className="text-xs leading-relaxed text-workstation-muted">
              Scan your face once to build a 3D model, then analyze and simulate procedures on it at your
              own pace.
            </span>
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'live-ar') {
    return <LiveArViewer onBack={() => setScreen('mode-select')} />
  }

  if (screen === 'scan') {
    return (
      <ScanController
        onComplete={(model) => {
          setFaceModel(model)
          setScreen('viewer')
        }}
      />
    )
  }

  if (faceModel && screen === 'simulation') {
    return <SimulationViewer faceModel={faceModel} onBack={() => setScreen('viewer')} />
  }

  if (faceModel) {
    return <FaceViewer faceModel={faceModel} onOpenSimulation={() => setScreen('simulation')} />
  }

  return null
}
