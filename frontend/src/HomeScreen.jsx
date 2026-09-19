import { useState } from 'react'
import { useAuth } from './AuthContext'
import Collection from './Collection'

export default function HomeScreen() {
  const { user, logout } = useAuth()
  const [screen, setScreen] = useState('home')

  return (
    <main className="home-page">
      <header className="home-header">
        <div className="identity">
          {user.profile_photo ? (
            <img src={user.profile_photo} alt="" className="avatar" />
          ) : (
            <span className="avatar fallback" aria-hidden="true">
              {user.display_name.slice(0, 1).toUpperCase()}
            </span>
          )}

          <div>
            <p className="eyebrow">Signed in</p>
            <h1>{user.display_name}</h1>
            <p className="email">{user.email}</p>
          </div>
        </div>

        <button
          type="button"
          className="ghost"
          onClick={() => logout()}
        >
          Sign out
        </button>
      </header>

      <nav>
        <button
          type="button"
          onClick={() => setScreen('home')}
        >
          Home
        </button>

        <button
          type="button"
          onClick={() => setScreen('collection')}
        >
          My Collection
        </button>
      </nav>

      {screen === 'home' && (
        <section className="home-card">
          <h2>Ready to play</h2>
          <p>Your account is set. The game table will land here next.</p>
        </section>
      )}

      {screen === 'collection' && <Collection />}
    </main>
  )
}