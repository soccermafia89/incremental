import { useEffect, useRef, useState } from 'react'
import type { MapScene } from '../../core/game/Game'
import { fitScale } from './fitScale'
import { MapView } from './MapView'

/** Draws the fixed board scaled to the space this element is given. */
export function FitMap({ scene, frame }: { scene: MapScene; frame: number }) {
  const slotRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const slot = slotRef.current
    if (!slot) return
    const measure = () => {
      const style = getComputedStyle(slot)
      const width = slot.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      const height = slot.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
      setScale(fitScale(width, height, scene.width, scene.height))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(slot)
    return () => observer.disconnect()
  }, [scene.width, scene.height])

  const scaledWidth = scene.width * scale
  const scaledHeight = scene.height * scale

  return (
    <div
      ref={slotRef}
      data-map-fit
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        padding: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        data-frame={frame}
        style={{ width: scaledWidth, height: scaledHeight, overflow: 'hidden', flexShrink: 0 }}
      >
        <div style={{
          width: scene.width,
          height: scene.height,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}>
          <MapView scene={scene} />
        </div>
      </div>
    </div>
  )
}
