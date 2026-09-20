import { useEffect, useRef, useState } from 'react'

/** Same ratio as CardUploadModal crop (portrait card). */
const CARD_ASPECT = 2 / 3

function frameSourceRect(videoWidth, videoHeight, aspect) {
  const videoAspect = videoWidth / videoHeight
  if (videoAspect > aspect) {
    const width = videoHeight * aspect
    return {
      sx: (videoWidth - width) / 2,
      sy: 0,
      sw: width,
      sh: videoHeight,
    }
  }
  const height = videoWidth / aspect
  return {
    sx: 0,
    sy: (videoHeight - height) / 2,
    sw: videoWidth,
    sh: height,
  }
}

export default function CardCameraCapture({ onCapture, onCancel }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            aspectRatio: { ideal: CARD_ASPECT },
          },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch {
        if (!cancelled) {
          setError('Could not open the camera. Allow camera access, or choose a file instead.')
        }
      }
    }
    startCamera()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  async function handleCapture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) {
      return
    }
    const { sx, sy, sw, sh } = frameSourceRect(video.videoWidth, video.videoHeight, CARD_ASPECT)
    const maxSide = 1600
    const scale = Math.min(1, maxSide / Math.max(sw, sh))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(sw * scale))
    canvas.height = Math.max(1, Math.round(sh * scale))
    canvas.getContext('2d').drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8))
    if (!blob) {
      setError('Could not capture this photo.')
      return
    }
    const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' })
    streamRef.current?.getTracks().forEach((track) => track.stop())
    onCapture(file)
  }

  return (
    <div className="card-upload-backdrop" role="presentation">
      <div
        className="card-upload-dialog card-source-dialog"
        role="dialog"
        aria-labelledby="card-camera-title"
        aria-modal="true"
      >
        <h2 id="card-camera-title">Take a photo</h2>
        <p className="card-upload-note">Frame the picture, then capture. You can crop it next.</p>
        <div className="card-camera-viewfinder">
          <video ref={videoRef} className="card-camera-video" autoPlay playsInline muted />
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="card-upload-actions">
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="primary card-upload-submit" onClick={handleCapture} disabled={Boolean(error)}>
            Capture
          </button>
        </div>
      </div>
    </div>
  )
}
