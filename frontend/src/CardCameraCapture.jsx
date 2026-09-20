import { useEffect, useRef, useState } from 'react'

export default function CardCameraCapture({ onCapture, onCancel }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
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
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
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
        <video ref={videoRef} className="card-camera-video" autoPlay playsInline muted />
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
