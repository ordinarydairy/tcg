export default function CardSourcePicker({ onChooseFiles, onOpenCamera, onCancel }) {
  return (
    <div className="card-upload-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="card-upload-dialog card-source-dialog"
        role="dialog"
        aria-labelledby="card-source-title"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="card-source-title">New card</h2>
        <p className="card-upload-note">Choose a photo from your device or take one with the camera.</p>
        <div className="card-source-actions">
          <button type="button" className="ghost" onClick={onChooseFiles}>
            Choose from files
          </button>
          <button type="button" className="ghost" onClick={onOpenCamera}>
            Open camera
          </button>
          <button type="button" className="primary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
