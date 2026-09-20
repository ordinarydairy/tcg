import { useCallback, useId, useState } from 'react'
import Cropper from 'react-easy-crop'
import { cropImageToFile } from './cardCrop'

const CARD_ASPECT = 2 / 3

export default function CardUploadModal({
  imageSrc,
  queueIndex,
  queueTotal,
  submitting,
  error,
  onCancel,
  onSkip,
  onUpload,
}) {
  const storyId = useId()
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [story, setStory] = useState('')
  const [cropError, setCropError] = useState('')

  const onCropAreaChange = useCallback((_area, pixels) => {
    setCroppedAreaPixels(pixels)
  }, [])

  async function handleUpload() {
    if (!croppedAreaPixels) {
      return
    }
    setCropError('')
    try {
      const file = await cropImageToFile(imageSrc, croppedAreaPixels)
      await onUpload(file, story.trim())
    } catch (cropFailed) {
      setCropError(cropFailed.message || 'Could not crop this image.')
    }
  }

  return (
    <div className="card-upload-backdrop" role="presentation">
      <div
        className="card-upload-dialog"
        role="dialog"
        aria-labelledby="card-upload-title"
        aria-modal="true"
      >
        <h2 id="card-upload-title">Add card</h2>
        <p className="card-upload-note">
          Crop stays inside the photo. Optional story is sent with this card.
          {queueTotal > 1 ? ` Image ${queueIndex + 1} of ${queueTotal}.` : ''}
        </p>

        <div className="card-cropper">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={0}
            minZoom={1}
            maxZoom={3}
            aspect={CARD_ASPECT}
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

        <label htmlFor={storyId}>
          Story (optional)
          <textarea
            id={storyId}
            className="card-story"
            rows={3}
            value={story}
            onChange={(event) => setStory(event.target.value)}
            placeholder="What makes this photo a card?"
          />
        </label>

        {error || cropError ? (
          <p className="form-error" role="alert">
            {error || cropError}
          </p>
        ) : null}

        <div className="card-upload-actions">
          <button type="button" className="card-upload-cancel" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          {queueTotal > 1 ? (
            <button type="button" className="ghost" onClick={onSkip} disabled={submitting}>
              Skip
            </button>
          ) : null}
          <button
            type="button"
            className="primary card-upload-submit"
            onClick={handleUpload}
            disabled={submitting || !croppedAreaPixels}
          >
            {submitting ? 'Uploading…' : 'Upload card'}
          </button>
        </div>
      </div>
    </div>
  )
}
