import { useEffect, useId, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { fetchPlayer, removeFriend, sendFriendRequest } from './api'
import { friendshipActionLabel } from './PlayerRow'
import './Profile.css'

const BLANK_CARDS = Array.from({ length: 10 }, (_, index) => ({
  id: index + 1,
}))

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
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const fileInputId = useId()
  const bioId = useId()
  const isOwn = !userId || String(user?.id) === String(userId)
  const [remotePlayer, setRemotePlayer] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [bio, setBio] = useState(DEFAULT_BIO)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const player = isOwn ? user : remotePlayer

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
            {user?.email ? <p className="profile-email">{user.email}</p> : null}
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
