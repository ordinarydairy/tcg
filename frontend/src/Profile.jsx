import { useEffect, useId, useState } from 'react'
import { cardImageSrc, fetchCards } from './api'
import { useAuth } from './AuthContext'
import './Profile.css'

const SLOT_COUNT = 10

const DEFAULT_BIO =
  'This is a placeholder bio. You can edit it here; it is not saved yet.'

function GearIcon() {
  return (
    <svg className="settings-gear-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11.3 2.7h1.4l.3 2.2a6.8 6.8 0 0 1 1.7.7l2-1.1 1 1-1.1 2a6.8 6.8 0 0 1 .7 1.7l2.2.3v1.4l-2.2.3a6.8 6.8 0 0 1-.7 1.7l1.1 2-1 1-2-1.1a6.8 6.8 0 0 1-1.7.7l-.3 2.2h-1.4l-.3-2.2a6.8 6.8 0 0 1-1.7-.7l-2 1.1-1-1 1.1-2a6.8 6.8 0 0 1-.7-1.7l-2.2-.3v-1.4l2.2-.3a6.8 6.8 0 0 1 .7-1.7l-1.1-2 1-1 2 1.1a6.8 6.8 0 0 1 1.7-.7l.3-2.2ZM12 9.2A2.8 2.8 0 1 0 12 14.8 2.8 2.8 0 0 0 12 9.2Z" />
    </svg>
  )
}

function Profile() {
  const { user, logout } = useAuth()
  const fileInputId = useId()
  const bioId = useId()
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [bio, setBio] = useState(DEFAULT_BIO)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [cards, setCards] = useState([])
  const displayName = user?.display_name || 'Player'
  const savedPhoto = user?.profile_photo
  const photoSrc = avatarUrl || savedPhoto
  const cardSlots = [
    ...cards,
    ...Array.from(
      { length: Math.max(0, SLOT_COUNT - cards.length) },
      (_, index) => ({ id: `empty-${index}` }),
    ),
  ]

  useEffect(() => {
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
  }, [])

  useEffect(() => {
    return () => {
      if (avatarUrl) {
        URL.revokeObjectURL(avatarUrl)
      }
    }
  }, [avatarUrl])

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

  return (
    <main className="profile">
      <header className="profile-toolbar">
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
          value={bio}
          onChange={(event) => setBio(event.target.value)}
        />
      </section>

      <section className="profile-cards" aria-labelledby="profile-cards-heading">
        <h2 id="profile-cards-heading">Cards</h2>
        <p className="profile-cards-note">
          {cards.length
            ? 'Saved cards from your collection.'
            : 'Empty slots until cards are saved on your account.'}
        </p>
        <ul className="card-grid">
          {cardSlots.map((card) => {
            const imageSrc = cardImageSrc(card.image)
            return (
              <li key={card.id} className="blank-card">
                <div className="blank-card-art">
                  {imageSrc ? (
                    <img src={imageSrc} alt={card.rarity || 'Saved card'} />
                  ) : null}
                </div>
                {card.rarity ? (
                  <p className="blank-card-rarity">{card.rarity}</p>
                ) : (
                  <div className="blank-card-title" />
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </main>
  )
}

export default Profile
