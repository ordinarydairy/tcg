import { useEffect, useId, useState } from 'react'
import { useAuth } from './AuthContext'
import './Profile.css'

const BLANK_CARDS = Array.from({ length: 10 }, (_, index) => ({
  id: index + 1,
}))

const DEFAULT_BIO =
  'This is a placeholder bio. You can edit it here; it is not saved yet.'

function Profile() {
  const { user } = useAuth()
  const fileInputId = useId()
  const bioId = useId()
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [bio, setBio] = useState(DEFAULT_BIO)
  const displayName = user?.display_name || 'Player'
  const savedPhoto = user?.profile_photo
  const photoSrc = avatarUrl || savedPhoto

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
          Blank slots for a future card upload system.
        </p>
        <ul className="card-grid">
          {BLANK_CARDS.map((card) => (
            <li key={card.id} className="blank-card">
              <div className="blank-card-art" />
              <div className="blank-card-title" />
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

export default Profile
