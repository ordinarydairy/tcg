import { useEffect, useId, useState } from 'react'
import { cardImageSrc, fetchCards } from './api'
import { useAddCard } from './AddCardContext.jsx'
import PhotoCropModal from './PhotoCropModal.jsx'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { fetchPlayer, removeFriend, sendFriendRequest } from './api'
import { friendshipActionLabel } from './PlayerRow'
import './Profile.css'

const SLOT_COUNT = 9

function ProfileCardTile({ card, onOpen }) {
  const imageSrc = cardImageSrc(card.image)
  const isSaved = Boolean(imageSrc)
  return (
    <li className={`blank-card${isSaved ? '' : ' is-empty'}`}>
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
      <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.05 7.05 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.55-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.48.48 0 0 0 .12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.86 14.52a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.3.59.22l2.39-.96c.5.39 1.04.71 1.62.94l.36 2.54c.05.23.25.41.48.41h3.84c.23 0 .43-.18.48-.41l.36-2.54c.59-.24 1.13-.55 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.03-1.58ZM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2Z" />
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
  const isOwn = !userId || String(user?.id) === String(userId)
  const { openAddCard, cardsRevision } = useAddCard()
  const [remotePlayer, setRemotePlayer] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [bio, setBio] = useState(user?.bio || '')
  const [bioStatus, setBioStatus] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [cards, setCards] = useState([])
  const [cardsLoading, setCardsLoading] = useState(true)
  const [selectedCard, setSelectedCard] = useState(null)
  const [cardFlipped, setCardFlipped] = useState(false)
  const [scoreBreakdownOpen, setScoreBreakdownOpen] = useState(false)
  const [cardTextTone, setCardTextTone] = useState('light')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [photoFailed, setPhotoFailed] = useState(false)
  const [photoStatus, setPhotoStatus] = useState('')
  const [photoCropSrc, setPhotoCropSrc] = useState('')
  const [savingPhoto, setSavingPhoto] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const player = isOwn ? user : remotePlayer

  useEffect(() => {
    const ownerId = isOwn ? user?.id : userId
    if (!ownerId) {
      setCards([])
      setCardsLoading(false)
      return undefined
    }
    let cancelled = false
    setCardsLoading(true)
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
      } finally {
        if (!cancelled) {
          setCardsLoading(false)
        }
      }
    }
    loadCards()
    return () => {
      cancelled = true
    }
  }, [isOwn, userId, user?.id, cardsRevision])

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
    if (!file.type.startsWith('image/')) {
      setPhotoStatus('Please choose an image for your profile photo.')
      return
    }
    if (file.size > 25 * 1024 * 1024) {
      setPhotoStatus('Profile photo must be 25MB or smaller.')
      return
    }
    setPhotoStatus('')
    setPhotoCropSrc((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous)
      }
      return URL.createObjectURL(file)
    })
  }

  function cancelPhotoCrop() {
    setPhotoCropSrc((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous)
      }
      return ''
    })
  }

  async function saveCroppedPhoto(file) {
    const nextUrl = URL.createObjectURL(file)
    setPhotoFailed(false)
    setSavingPhoto(true)
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
      cancelPhotoCrop()
    } catch (error) {
      setPhotoStatus(error.message || 'Could not save photo.')
    } finally {
      setSavingPhoto(false)
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
    ...cards.slice(0, SLOT_COUNT),
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
              {cardsLoading
                ? 'Loading collection…'
                : cards.length
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
              onClick={openAddCard}
            >
              Add cards
            </button>
          ) : null}
        </div>
        {cardsLoading ? (
          <p className="cards-loading" role="status">Loading cards…</p>
        ) : (
          <ul className="card-grid">
            {cardSlots.map((card) => (
              <ProfileCardTile key={card.id} card={card} onOpen={setSelectedCard} />
            ))}
          </ul>
        )}
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
      {photoCropSrc ? (
        <PhotoCropModal
          imageSrc={photoCropSrc}
          busy={savingPhoto}
          onCancel={cancelPhotoCrop}
          onConfirm={saveCroppedPhoto}
        />
      ) : null}
    </main>
  )
}

export default Profile
