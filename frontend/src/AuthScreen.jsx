import { useId, useState } from 'react'
import { useAuth } from './AuthContext'
import logo from './assets/logo.png'
import PhotoCropModal from './PhotoCropModal.jsx'

export default function AuthScreen() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [photo, setPhoto] = useState(null)
  const [preview, setPreview] = useState('')
  const [cropSrc, setCropSrc] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const photoId = useId()

  function onPhotoChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image for your profile photo.')
      return
    }
    if (file.size > 25 * 1024 * 1024) {
      setError('Profile photo must be 25MB or smaller.')
      return
    }
    setError('')
    setCropSrc((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous)
      }
      return URL.createObjectURL(file)
    })
  }

  function cancelPhotoCrop() {
    setCropSrc((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous)
      }
      return ''
    })
  }

  async function confirmPhotoCrop(file) {
    setPhoto(file)
    setPreview((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous)
      }
      return URL.createObjectURL(file)
    })
    cancelPhotoCrop()
  }

  async function onSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
    if (mode === 'signin') {
        await login(email, password)
      } else {
        if (!photo) {
          setError('Please choose and crop a profile photo.')
          return
        }
        await register({ email, password, displayName, photo })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <img className="auth-logo" src={logo} alt="TCG" width="512" height="512" />
        <h1>{mode === 'signin' ? 'Sign in' : 'Create account'}</h1>
        <p className="lede">
          {mode === 'signin'
            ? 'Use your email and password to continue.'
            : 'Set a display name and profile photo for your player profile.'}
        </p>

        <div className="mode-toggle" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            className={mode === 'signin' ? 'active' : ''}
            onClick={() => {
              setMode('signin')
              setError('')
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => {
              setMode('signup')
              setError('')
            }}
          >
            Create account
          </button>
        </div>

        <form onSubmit={onSubmit}>
          {mode === 'signup' && (
            <>
              <label>
                Display name
                <input
                  type="text"
                  name="displayName"
                  autoComplete="nickname"
                  minLength={2}
                  maxLength={50}
                  required
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>

              <div className="photo-field">
                <span className="photo-label">Profile photo</span>
                <label className="photo-picker" htmlFor={photoId}>
                  <span className="photo-preview" aria-hidden="true">
                    {preview ? <img src={preview} alt="" /> : <span>Add</span>}
                  </span>
                  <span>{preview ? 'Change photo' : 'Choose a photo'}</span>
                </label>
                <input
                  id={photoId}
                  type="file"
                  name="profilePhoto"
                  accept="image/*"
                  onChange={onPhotoChange}
                />
              </div>
            </>
          )}

          <label>
            Email
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label>
            Password
            <span className="password-row">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                className="ghost password-toggle"
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </span>
          </label>

          {error ? <p className="form-error" role="alert">{error}</p> : null}

          <button type="submit" className="primary" disabled={submitting}>
            {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
      {cropSrc ? (
        <PhotoCropModal
          imageSrc={cropSrc}
          confirmLabel="Use photo"
          onCancel={cancelPhotoCrop}
          onConfirm={confirmPhotoCrop}
        />
      ) : null}
    </main>
  )
}
