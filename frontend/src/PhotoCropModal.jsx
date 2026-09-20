import { useCallback, useState } from 'react'
import Cropper from 'react-easy-crop'
import { cropImageToFile } from './cardCrop'
import './PhotoCropModal.css'

export default function PhotoCropModal({
  imageSrc,
  title = 'Crop profile photo',
  confirmLabel = 'Use photo',
  busy = false,
  onCancel,
  onConfirm,
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [cropError, setCropError] = useState('')

  const onCropAreaChange = useCallback((_area, pixels) => {
    setCroppedAreaPixels(pixels)
  }, [])

  async function handleConfirm() {
    if (!croppedAreaPixels || busy) {
      return
    }
    setCropError('')
    try {
      const file = await cropImageToFile(imageSrc, croppedAreaPixels, 'profile.jpg', {
        maxSide: 800,
        quality: 0.78,
      })
      await onConfirm(file)
    } catch (error) {
      setCropError(error.message || 'Could not crop this image.')
    }
  }

  return (
    <div className="card-upload-backdrop" role="presentation">
      <div
        className="card-upload-dialog photo-crop-dialog"
        role="dialog"
        aria-labelledby="photo-crop-title"
        aria-modal="true"
      >
        <h2 id="photo-crop-title">{title}</h2>
        <p className="card-upload-note">Drag and zoom until the circle frames your photo.</p>
        <div className="avatar-cropper">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={0}
            minZoom={1}
            maxZoom={3}
            aspect={1}
            cropShape="round"
            showGrid={false}
            restrictPosition
            objectFit="contain"
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropAreaChange={onCropAreaChange}
            onCropComplete={onCropAreaChange}
          />
        </div>
        <label className="card-zoom-label">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
        {cropError ? (
          <p className="form-error" role="alert">
            {cropError}
          </p>
        ) : null}
        <div className="card-upload-actions">
          <button type="button" className="card-upload-cancel" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="primary card-upload-submit"
            onClick={handleConfirm}
            disabled={busy || !croppedAreaPixels}
          >
            {busy ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
