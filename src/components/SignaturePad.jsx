import { useRef } from 'react'
import { T } from './ui/index.jsx'

export function SignaturePad({ onSigned, onClear, height = 140, ariaDescribedBy, ariaLabelledby }) {
  const canvasRef = useRef(null)
  const drawing   = useRef(false)
  const hasMark   = useRef(false)
  const h = Math.max(80, Math.min(320, Number(height) || 140))

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const src  = e.touches ? e.touches[0] : e
    return {
      x: (src.clientX - rect.left) * (canvas.width / rect.width),
      y: (src.clientY - rect.top)  * (canvas.height / rect.height),
    }
  }

  const start = e => {
    e.preventDefault()
    drawing.current = true
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = getPos(e, canvasRef.current)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const move = e => {
    if (!drawing.current) return
    e.preventDefault()
    hasMark.current = true
    const ctx = canvasRef.current.getContext('2d')
    ctx.lineWidth   = 2
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    ctx.strokeStyle = T.navy
    const { x, y } = getPos(e, canvasRef.current)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stop = () => {
    if (!drawing.current) return
    drawing.current = false
    if (hasMark.current) {
      onSigned(canvasRef.current.toDataURL('image/png'))
    }
  }

  const clear = () => {
    const ctx = canvasRef.current.getContext('2d')
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    hasMark.current = false
    onClear()
  }

  return (
    <div>
      <div style={{
        border: `1.5px solid ${T.border}`, borderRadius: '8px',
        background: '#fafafa', position: 'relative', overflow: 'hidden',
      }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={Math.round(Math.max(96, h) * 1.5)}
          style={{ display: 'block', width: '100%', height: `${h}px`, cursor: 'crosshair', touchAction: 'none' }}
          onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop}
          onTouchStart={start} onTouchMove={move} onTouchEnd={stop}
          aria-label={ariaLabelledby ? undefined : 'Signature pad — draw your signature here'}
          aria-labelledby={ariaLabelledby || undefined}
          aria-describedby={ariaDescribedBy || undefined}
          role="img"
        />
        <div style={{
          position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)',
          fontSize: '11px', color: '#cbd5e1', pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          Sign here with your mouse or finger
        </div>
      </div>
      <button
        type="button"
        onClick={clear}
        style={{
          marginTop: '8px', padding: '5px 14px', borderRadius: '6px',
          fontSize: '11px', fontWeight: '600', cursor: 'pointer',
          background: T.dangerBg, color: T.danger, border: `1px solid ${T.dangerBorder}`,
        }}
      >
        Clear Signature
      </button>
    </div>
  )
}
