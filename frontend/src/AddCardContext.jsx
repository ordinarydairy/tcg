import { createContext, useContext, useId, useRef, useState } from 'react'
import { gradeCard } from './api'
import CardCameraCapture from './CardCameraCapture.jsx'
import CardSourcePicker from './CardSourcePicker.jsx'
import CardUploadModal from './CardUploadModal.jsx'
import './Profile.css'

const AddCardContext = createContext(null)

export function useAddCard() {
  const value = useContext(AddCardContext)
  if (!value) {
    throw new Error('useAddCard must be used inside AddCardProvider')
  }
  return value
}

export function AddCardProvider({ children }) {
  const cardInputId = useId()
  const cardFileInputRef = useRef(null)
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [uploadQueue, setUploadQueue] = useState([])
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [cardsRevision, setCardsRevision] = useState(0)

  function openAddCard() {
    setSourcePickerOpen(true)
  }

  function revokeQueue(items) {
    items.forEach((item) => URL.revokeObjectURL(item.url))
  }

  function enqueueCardFiles(fileList) {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith('image/'))
    if (!files.length) {
      return
    }
    setSourcePickerOpen(false)
    setCameraOpen(false)
    setUploadError('')
    setUploadQueue((current) => [
      ...current,
      ...files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    ])
  }

  function handleCardFiles(event) {
    enqueueCardFiles(event.target.files)
    event.target.value = ''
  }

  function closeUploader() {
    setUploadQueue((current) => {
      revokeQueue(current)
      return []
    })
    setUploadError('')
    setUploading(false)
  }

  function skipCurrentUpload() {
    setUploadQueue((current) => {
      if (current[0]) {
        URL.revokeObjectURL(current[0].url)
      }
      return current.slice(1)
    })
    setUploadError('')
  }

  async function uploadCurrentCard(image, story) {
    setUploading(true)
    setUploadError('')
    try {
      await gradeCard({ image, story })
      setCardsRevision((current) => current + 1)
      skipCurrentUpload()
    } catch (error) {
      setUploadError(error.message || 'Could not upload this card.')
    } finally {
      setUploading(false)
    }
  }

  const overlayOpen = sourcePickerOpen || cameraOpen || Boolean(uploadQueue[0])

  return (
    <AddCardContext.Provider value={{ openAddCard, cardsRevision, overlayOpen }}>
      {children}
      <input
        id={cardInputId}
        ref={cardFileInputRef}
        className="profile-photo-input"
        type="file"
        accept="image/*"
        multiple
        onChange={handleCardFiles}
      />
      {sourcePickerOpen ? (
        <CardSourcePicker
          onChooseFiles={() => cardFileInputRef.current?.click()}
          onOpenCamera={() => {
            setSourcePickerOpen(false)
            setCameraOpen(true)
          }}
          onCancel={() => setSourcePickerOpen(false)}
        />
      ) : null}
      {cameraOpen ? (
        <CardCameraCapture
          onCapture={(file) => enqueueCardFiles([file])}
          onCancel={() => setCameraOpen(false)}
        />
      ) : null}
      {uploadQueue[0] ? (
        <CardUploadModal
          key={uploadQueue[0].url}
          imageSrc={uploadQueue[0].url}
          queueIndex={0}
          queueTotal={uploadQueue.length}
          submitting={uploading}
          error={uploadError}
          onCancel={closeUploader}
          onSkip={skipCurrentUpload}
          onUpload={uploadCurrentCard}
        />
      ) : null}
    </AddCardContext.Provider>
  )
}
