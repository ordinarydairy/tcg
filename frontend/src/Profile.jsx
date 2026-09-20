import { useEffect, useId, useRef, useState } from 'react'
import { cardImageSrc, fetchCards, gradeCard } from './api'
import CardCameraCapture from './CardCameraCapture.jsx'
import CardSourcePicker from './CardSourcePicker.jsx'
import CardUploadModal from './CardUploadModal.jsx'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { fetchPlayer, removeFriend, sendFriendRequest } from './api'
import { friendshipActionLabel } from './PlayerRow'
import './Profile.css'

const SLOT_COUNT = 10

function ProfileCardTile({ card, onOpen }) {
  const imageSrc = cardImageSrc(card.image)
  const isSaved = Boolean(imageSrc)
  return (
    <li className="blank-card">
      {isSaved ? (
        <button
          type="button"
          className="blank-card-button"
          onClick={() => onOpen(card)}
        >
          <img
            src={imageSrc}
            alt=""
            className="card-full-image"
          />

          <div className="card-rarity-stars" aria-label={card.rarity}>
            {Array.from(
              { length: rarityStars(card.rarity).length },
              (_, index) => (
                <span key={index}>★</span>
              )
            )}
          </div>
        </button>
      ) : (
        <>
          <div className="blank-card-art" />
          <div className="blank-card-title" />
        </>
      )}
    </li>
  )
}

function GearIcon() {
  return (
    <svg className="settings-gear-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11.3 2.7h1.4l.3 2.2a6.8 6.8 0 0 1 1.7.7l2-1.1 1 1-1.1 2a6.8 6.8 0 0 1 .7 1.7l2.2.3v1.4l-2.2.3a6.8 6.8 0 0 1-.7 1.7l1.1 2-1 1-2-1.1a6.8 6.8 0 0 1-1.7.7l-.3 2.2h-1.4l-.3-2.2a6.8 6.8 0 0 1-1.7-.7l-2 1.1-1-1 1.1-2a6.8 6.8 0 0 1-.7-1.7l-2.2-.3v-1.4l2.2-.3a6.8 6.8 0 0 1 .7-1.7l-1.1-2 1-1 2 1.1a6.8 6.8 0 0 1 1.7-.7l.3-2.2ZM12 9.2A2.8 2.8 0 1 0 12 14.8 2.8 2.8 0 0 0 12 9.2Z" />
    </svg>
  )
}


function getImageTextColor(imageSrc) {
  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'

    image.onload = () => {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      canvas.width = 20
      canvas.height = 20

      context.drawImage(image, 0, 0, 20, 20)

      try {
        const data = context.getImageData(0, 0, 20, 20).data

        let brightness = 0

        for (let i = 0; i < data.length; i += 4) {
          brightness +=
            data[i] * 0.299 +
            data[i + 1] * 0.587 +
            data[i + 2] * 0.114
        }

        brightness /= data.length / 4

        resolve(brightness < 125 ? 'light' : 'dark')
      } catch {
        resolve('light')
      }
    }

    image.onerror = () => resolve('light')
    image.src = imageSrc
  })
}

function rarityStars(rarity) {
  const stars = {
    Common: 1,
    Uncommon: 2,
    Rare: 3,
    Epic: 4,
    Legendary: 5,
  }

  return '★'.repeat(stars[rarity] || 1)
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [cards, setCards] = useState([])
  const [uploadQueue, setUploadQueue] = useState([])
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const cardFileInputRef = useRef(null)
  const [selectedCard, setSelectedCard] = useState(null)
  const [cardFlipped, setCardFlipped] = useState(false)
  const [scoreBreakdownOpen, setScoreBreakdownOpen] = useState(false)
  const [cardTextTone, setCardTextTone] = useState('light')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [photoFailed, setPhotoFailed] = useState(false)
  const [photoStatus, setPhotoStatus] = useState('')
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const player = isOwn ? user : remotePlayer

  useEffect(() => {
    const ownerId = isOwn ? user?.id : userId
    if (!ownerId) {
      setCards([])
      return undefined
    }
    let cancelled = false
    async function loadCards() {
      try {
        const data = await fetchCards(isOwn ? undefined : ownerId)
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
  }, [isOwn, userId, user?.id])

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
    setPhotoFailed(false)
  }, [player?.id, player?.profile_photo])

  useEffect(() => {
    return () => {
      if (avatarUrl) {
        URL.revokeObjectURL(avatarUrl)
      }
    }
  }, [avatarUrl])

  useEffect(() => {
  if (!selectedCard) return

  const imageSrc = cardImageSrc(selectedCard.image)

  getImageTextColor(imageSrc).then((tone) => {
    setCardTextTone(tone)
  })
  }, [selectedCard])

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

  async function saveProfileEdit() {
    if (savingProfile) {
      return
    }
    setSavingProfile(true)
    setBioStatus('')
    try {
      await updateProfile({ display_name: draftName, bio })
      setEditing(false)
      setBioStatus('Saved')
    } catch (error) {
      setBioStatus(error.message || 'Could not save profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  function startEditing() {
    setDraftName(user?.display_name || '')
    setBio(user?.bio || '')
    setBioStatus('')
    setEditing(true)
  }

  function cancelEditing() {
    setBio(user?.bio || '')
    setEditing(false)
    setBioStatus('')
  }

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    const nextUrl = URL.createObjectURL(file)
    setPhotoFailed(false)
    setPhotoStatus('Saving photo…')
    setAvatarUrl((previousUrl) => {
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl)
      }
      return nextUrl
    })
    try {
      const body = new FormData()
      body.append('profile_photo', file)
      await updateProfile(body)
      setPhotoStatus('Photo saved')
      setAvatarUrl((previousUrl) => {
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl)
        }
        return null
      })
    } catch (error) {
      setPhotoStatus(error.message || 'Could not save photo.')
    }
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
        {isOwn ? (
          <label className="profile-avatar profile-avatar-edit" htmlFor={fileInputId} aria-label="Change profile photo">
            {photoSrc && !photoFailed ? (
              <img
                src={photoSrc}
                alt={`${displayName}'s profile`}
                onError={() => setPhotoFailed(true)}
              />
            ) : (
              <div className="profile-avatar-placeholder" aria-hidden="true">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
          </label>
        ) : (
          <div className="profile-avatar">
            {photoSrc && !photoFailed ? (
              <img
                src={photoSrc}
                alt={`${displayName}'s profile`}
                onError={() => setPhotoFailed(true)}
              />
            ) : (
              <div className="profile-avatar-placeholder" aria-hidden="true">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
        )}
        {isOwn ? (
          <input
            id={fileInputId}
            className="profile-photo-input"
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
          />
        ) : null}
        {photoStatus ? <p className="profile-bio-hint">{photoStatus}</p> : null}
        {editing ? (
          <label className="profile-bio-label" htmlFor={`${bioId}-name`}>
            Display name
            <input
              id={`${bioId}-name`}
              className="profile-name-input"
              value={draftName}
              maxLength={50}
              onChange={(event) => setDraftName(event.target.value)}
            />
          </label>
        ) : (
          <h1 className="profile-name">{displayName}</h1>
        )}
        {player?.tag ? <p className="profile-tag">#{player.tag}</p> : null}
        {isOwn ? (
          editing ? (
            <>
              <label className="profile-bio-label" htmlFor={bioId}>
                Bio
              </label>
              <textarea
                id={bioId}
                className="profile-bio"
                rows={3}
                maxLength={500}
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder="Write a short bio."
              />
              {bioStatus ? <p className="form-error">{bioStatus}</p> : null}
              <div className="profile-edit-actions">
                <button type="button" className="primary profile-friend-button" onClick={saveProfileEdit} disabled={savingProfile}>
                  {savingProfile ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="ghost" onClick={cancelEditing} disabled={savingProfile}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="profile-bio-text">{user?.bio?.trim() ? user.bio : 'No bio yet.'}</p>
              <button type="button" className="ghost profile-friend-button" onClick={startEditing}>
                Edit profile
              </button>
            </>
          )
        ) : (
          <>
            <p className="profile-bio-text">{player?.bio?.trim() ? player.bio : 'No bio yet.'}</p>
            {error ? <p className="form-error">{error}</p> : null}
            {player?.friendship_status && player.friendship_status !== 'self' ? (
              <div className="profile-trade-actions">
                {player.friendship_status === 'friends' ? (
                  <button
                    type="button"
                    className="primary profile-friend-button"
                    onClick={() => navigate(`/trades/new?userId=${player.id}`)}
                  >
                    Trade
                  </button>
                ) : null}
                <button
                  type="button"
                  className={player.friendship_status === 'friends' ? 'ghost' : 'primary profile-friend-button'}
                  disabled={busy || player.friendship_status === 'pending_sent'}
                  onClick={handleFriendship}
                >
                  {busy ? 'Please wait…' : actionLabel}
                </button>
              </div>
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
                ? isOwn
                  ? 'Saved cards from your collection.'
                  : 'Cards from their collection.'
                : isOwn
                  ? 'Empty slots until you upload cards.'
                  : 'They have not uploaded cards yet.'}
            </p>
          </div>
          {isOwn ? (
            <button
              type="button"
              className="profile-photo-button"
              onClick={() => setSourcePickerOpen(true)}
            >
              Add cards
            </button>
          ) : null}
          <input
            id={cardInputId}
            ref={cardFileInputRef}
            className="profile-photo-input"
            type="file"
            accept="image/*"
            multiple
            onChange={handleCardFiles}
          />
        </div>
        <ul className="card-grid">
          {cardSlots.map((card) => (
            <ProfileCardTile key={card.id} card={card} onOpen={setSelectedCard} />
          ))}
        </ul>
      </section>
      {selectedCard ? (
        <div
          className="card-upload-backdrop"
          role="presentation"
          onClick={() => {
            setSelectedCard(null)
            setCardFlipped(false)
            setScoreBreakdownOpen(false)
          }}
        >
          <div
            className="card-flip-dialog"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >

            <div
                className={`card-flip ${cardFlipped ? 'is-flipped' : ''}`}
                onClick={() => {
                  if (scoreBreakdownOpen) {
                    setScoreBreakdownOpen(false)
                    return
                  }

                  setCardFlipped((flipped) => !flipped)
                }}
              >
              <div className="card-flip-inner">

                {/* FRONT */}
                <div className={`card-face card-front ${cardTextTone}`}>
                  <img
                    src={cardImageSrc(selectedCard.image)}
                    alt=""
                    className="card-full-image"
                  />

                  <div
                    className="card-rarity-stars"
                    aria-label={selectedCard.rarity}
                  >
                    {Array.from(
                      { length: rarityStars(selectedCard.rarity).length },
                      (_, index) => (
                        <span key={index}>★</span>
                      )
                    )}
                  </div>
                </div>


                {/* BACK */}
                <div className={`card-face card-back ${cardTextTone}`}>
                  <img
                    src={cardImageSrc(selectedCard.image)}
                    alt=""
                    className="card-back-image"
                  />

                  <div className="card-back-overlay" />

                  <div className="card-back-content">

                    <div className="card-back-info">
                      <p className="card-back-rarity">
                        {selectedCard.rarity}
                      </p>

                      <p className="card-back-username">
                        {selectedCard.creator_display_name || 'Player'}
                        {selectedCard.creator_tag ? ` #${selectedCard.creator_tag}` : ''}
                      </p>

                      {selectedCard.story?.trim() ? (
                        <p className="card-back-description">
                          {selectedCard.story}
                        </p>
                      ) : null}

                      <div className="card-score-area">
                        <button
                          type="button"
                          className="card-score-button"
                          onClick={(event) => {
                            event.stopPropagation()
                            setScoreBreakdownOpen((open) => !open)
                          }}
                          aria-expanded={scoreBreakdownOpen}
                        >
                          <span className="card-score-value">
                            {selectedCard.overall_score ?? selectedCard.score ?? 0}/100
                          </span>
                        </button>

                        {scoreBreakdownOpen ? (
                          <div
                            className="card-score-breakdown"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="score-breakdown-close"
                              aria-label="Close score breakdown"
                              onClick={(event) => {
                                event.stopPropagation()
                                setScoreBreakdownOpen(false)
                              }}
                            >
                            </button>

                            <div className="score-breakdown-item">
                            <div className="score-breakdown-heading">
                              <span>Photo Quality</span>
                              <strong>{selectedCard.scores?.photo_quality ?? '—'}/10</strong>
                            </div>

                            
                          </div>

                          <div className="score-breakdown-item">
                            <div className="score-breakdown-heading">
                              <span>Location Significance</span>
                              <strong>{selectedCard.scores?.location_significance ?? '—'}/10</strong>
                            </div>

                            
                          </div>

                          <div className="score-breakdown-item">
                            <div className="score-breakdown-heading">
                              <span>Occasion</span>
                              <strong>{selectedCard.scores?.occasion ?? '—'}/10</strong>
                            </div>

                            
                          </div>

                          <div className="score-breakdown-item">
                            <div className="score-breakdown-heading">
                              <span>Uniqueness</span>
                              <strong>{selectedCard.scores?.uniqueness ?? '—'}/10</strong>
                            </div>

                            
                          </div>

                          <div className="score-breakdown-item">
                            <div className="score-breakdown-heading">
                              <span>Memory / Story</span>
                              <strong>{selectedCard.scores?.memory_story ?? '—'}/10</strong>
                            </div>

                            
                          </div>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div
                      className="card-rarity-stars"
                      aria-label={selectedCard.rarity}
                    >
                      {Array.from(
                        { length: rarityStars(selectedCard.rarity).length },
                        (_, index) => (
                          <span key={index}>★</span>
                        )
                      )}
                    </div>

                  </div>
                </div>

              </div>
            </div>

            <p className="card-flip-hint">
              Click card to flip
            </p>

            <button
              type="button"
              className="ghost"
              onClick={() => {
                setSelectedCard(null)
                setCardFlipped(false)
                setScoreBreakdownOpen(false)
              }}
            >
              Close
            </button>

          </div>
        </div>
      ) : null}
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
    </main>
  )
}

export default Profile
