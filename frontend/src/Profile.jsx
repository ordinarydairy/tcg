import { useEffect, useId, useState } from 'react'
import { cardImageSrc, fetchCards, gradeCard } from './api'
import CardUploadModal from './CardUploadModal.jsx'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { fetchPlayer, removeFriend, sendFriendRequest } from './api'
import { friendshipActionLabel } from './PlayerRow'
import './Profile.css'

const SLOT_COUNT = 10

function GearIcon() {
  return (
    <svg className="settings-gear-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11.3 2.7h1.4l.3 2.2a6.8 6.8 0 0 1 1.7.7l2-1.1 1 1-1.1 2a6.8 6.8 0 0 1 .7 1.7l2.2.3v1.4l-2.2.3a6.8 6.8 0 0 1-.7 1.7l1.1 2-1 1-2-1.1a6.8 6.8 0 0 1-1.7.7l-.3 2.2h-1.4l-.3-2.2a6.8 6.8 0 0 1-1.7-.7l-2 1.1-1-1 1.1-2a6.8 6.8 0 0 1-.7-1.7l-2.2-.3v-1.4l2.2-.3a6.8 6.8 0 0 1 .7-1.7l-1.1-2 1-1 2 1.1a6.8 6.8 0 0 1 1.7-.7l.3-2.2ZM12 9.2A2.8 2.8 0 1 0 12 14.8 2.8 2.8 0 0 0 12 9.2Z" />
    </svg>
  )
}

function Profile() {
  const { user, logout, updateProfile } = useAuth()
  const { userId } = useParams()
  const navigate = useNavigate()
  const fileInputId = useId()
  const bioId = useId()
  const cardInputId = useId()
  const isOwn = !userId || String(user?.id) === String(userId)
  const [remotePlayer, setRemotePlayer] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [bio, setBio] = useState(user?.bio || '')
  const [bioStatus, setBioStatus] = useState('')
  const [savingBio, setSavingBio] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [cards, setCards] = useState([])
  const [uploadQueue, setUploadQueue] = useState([])
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const player = isOwn ? user : remotePlayer

  useEffect(() => {
    if (!isOwn) {
      setCards([])
      return undefined
    }
    let cancelled = false
    async function loadCards() {
      try {
        const data = await fetchCards()
        if (!cancelled && Array.isArray(data)) {
          setCards(data)
        }
      } catch {
        if (!cancelled) {
          setCards([])
        }
      }
    }
    loadCards()
    return () => {
      cancelled = true
    }
  }, [isOwn])

  useEffect(() => {
    setBio(user?.bio || '')
  }, [user?.bio])

  useEffect(() => {
    if (isOwn) {
      return undefined
    }
    let cancelled = false
    fetchPlayer(userId)
      .then((data) => {
        if (!cancelled) setRemotePlayer(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [isOwn, userId])

  useEffect(() => {
    return () => {
      if (avatarUrl) {
        URL.revokeObjectURL(avatarUrl)
      }
    }
  }, [avatarUrl])

  function revokeQueue(items) {
    items.forEach((item) => URL.revokeObjectURL(item.url))
  }

  function handleCardFiles(event) {
    const files = Array.from(event.target.files || []).filter((file) =>
      file.type.startsWith('image/'),
    )
    event.target.value = ''
    if (!files.length) {
      return
    }
    setUploadError('')
    setUploadQueue((current) => [
      ...current,
      ...files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    ])
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
      const data = await fetchCards()
      if (Array.isArray(data)) {
        setCards(data)
      }
      skipCurrentUpload()
    } catch (error) {
      setUploadError(error.message || 'Could not upload this card.')
    } finally {
      setUploading(false)
    }
  }

  async function saveBio() {
    if (savingBio) {
      return
    }
    setSavingBio(true)
    setBioStatus('')
    try {
      await updateProfile({ bio })
      setBioStatus('Saved')
    } catch (error) {
      setBioStatus(error.message || 'Could not save bio.')
    } finally {
      setSavingBio(false)
    }
  }

  function handleBioKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      saveBio()
    }
  }

  function handlePhotoChange(event) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const nextUrl = URL.createObjectURL(file)
    setAvatarUrl((previousUrl) => {
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl)
      }
      return nextUrl
    })
  }

  async function handleFriendship() {
    if (!player) return
    setBusy(true)
    setError('')
    try {
      if (player.friendship_status === 'friends') {
        await removeFriend(player.id)
        setRemotePlayer(await fetchPlayer(player.id))
      } else {
        const updated = await sendFriendRequest(player.id)
        setRemotePlayer(updated)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!isOwn && !player && !error) {
    return (
      <main className="profile">
        <p className="lede">Loading…</p>
      </main>
    )
  }

  const displayName = player?.display_name || 'Player'
  const savedPhoto = player?.profile_photo
  const photoSrc = isOwn ? avatarUrl || savedPhoto : savedPhoto
  const actionLabel =
    player?.friendship_status === 'friends' ? 'Remove friend' : friendshipActionLabel(player?.friendship_status)
  const cardSlots = [
    ...cards,
    ...Array.from(
      { length: Math.max(0, SLOT_COUNT - cards.length) },
      (_, index) => ({ id: `empty-${index}` }),
    ),
  ]

  return (
    <main className="profile">
      <header className="profile-toolbar">
        {isOwn ? (
          <>
            <button
              type="button"
              className="settings-gear"
              aria-label="Settings"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((open) => !open)}
            >
              <GearIcon />
            </button>
            {settingsOpen ? (
              <div className="settings-panel" role="dialog" aria-label="Account settings">
                <p className="settings-heading">Account</p>
                {user?.email ? <p className="settings-email">{user.email}</p> : null}
                <button type="button" className="ghost" onClick={() => logout()}>
                  Sign out
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <button type="button" className="ghost" onClick={() => navigate(-1)}>
            Back
          </button>
        )}
      </header>

      <section className="profile-identity">
        <div className="profile-avatar">
          {photoSrc ? (
            <img src={photoSrc} alt={`${displayName}'s profile`} />
          ) : (
            <div className="profile-avatar-placeholder" aria-hidden="true">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <h1 className="profile-name">{displayName}</h1>
        {isOwn ? (
          <>
            <label className="profile-photo-button" htmlFor={fileInputId}>
              Change photo
            </label>
            <input
              id={fileInputId}
              className="profile-photo-input"
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
            />
            <label className="profile-bio-label" htmlFor={bioId}>
              Bio
            </label>
            <textarea
              id={bioId}
              className="profile-bio"
              rows={3}
              maxLength={500}
              value={bio}
              onChange={(event) => {
                setBio(event.target.value)
                setBioStatus('')
              }}
              onKeyDown={handleBioKeyDown}
              placeholder="Write a short bio. Press Enter to save."
            />
            <p className="profile-bio-hint">
              {savingBio ? 'Saving…' : bioStatus || 'Press Enter to save. Shift+Enter adds a new line.'}
            </p>
          </>
        ) : (
          <>
            {error ? <p className="form-error">{error}</p> : null}
            {player?.friendship_status && player.friendship_status !== 'self' ? (
              <button
                type="button"
                className={player.friendship_status === 'friends' ? 'ghost' : 'primary profile-friend-button'}
                disabled={busy || player.friendship_status === 'pending_sent'}
                onClick={handleFriendship}
              >
                {busy ? 'Please wait…' : actionLabel}
              </button>
            ) : null}
          </>
        )}
      </section>

      <section className="profile-cards" aria-labelledby="profile-cards-heading">
        <div className="profile-cards-header">
          <div>
            <h2 id="profile-cards-heading">Cards</h2>
            <p className="profile-cards-note">
              {cards.length
                ? 'Saved cards from your collection.'
                : 'Empty slots until you upload cards.'}
            </p>
          </div>
          {isOwn ? (
            <label className="profile-photo-button" htmlFor={cardInputId}>
              Add cards
            </label>
          ) : null}
          <input
            id={cardInputId}
            className="profile-photo-input"
            type="file"
            accept="image/*"
            multiple
            onChange={handleCardFiles}
          />
        </div>
        <ul className="card-grid">
          {cardSlots.map((card) => {
            const imageSrc = cardImageSrc(card.image)
            const isSaved = Boolean(imageSrc)
            return (
              <li key={card.id} className="blank-card">
                {isSaved ? (
                  <button
                    type="button"
                    className="blank-card-button"
                    onClick={() => setSelectedCard(card)}
                  >
                    <div className="blank-card-art">
                      <img src={imageSrc} alt="" />
                    </div>
                    <p className="blank-card-rarity">{card.rarity}</p>
                  </button>
                ) : (
                  <>
                    <div className="blank-card-art" />
                    <div className="blank-card-title" />
                  </>
                )}
              </li>
            )
          })}
        </ul>
      </section>
      {selectedCard ? (
        <div className="card-upload-backdrop" role="presentation" onClick={() => setSelectedCard(null)}>
          <div
            className="card-story-dialog"
            role="dialog"
            aria-labelledby="card-story-title"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="card-story-art">
              <img
                src={cardImageSrc(selectedCard.image)}
                alt={selectedCard.rarity || 'Saved card'}
              />
            </div>
            <div className="card-story-copy">
              <p className="card-story-kicker">{selectedCard.rarity}</p>
              <h2 id="card-story-title">
                {selectedCard.overall_score != null
                  ? `${selectedCard.overall_score}/100`
                  : 'Card'}
              </h2>
              <p className="card-story-text">
                {selectedCard.story?.trim()
                  ? selectedCard.story
                  : 'No story was added for this card.'}
              </p>
              <button type="button" className="ghost" onClick={() => setSelectedCard(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
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
    </main>
  )
}

export default Profile
