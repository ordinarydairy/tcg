import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { fetchFriends, fetchTrades } from './api'
import './Layout.css'

function HomeIcon() {
  return (
    <svg className="tab-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 10.5 12 4.5l7.5 6V20a1.5 1.5 0 0 1-1.5 1.5h-4.5v-6h-4.5v6H6A1.5 1.5 0 0 1 4.5 20z" />
    </svg>
  )
}

function FriendsIcon() {
  return (
    <svg className="tab-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8.5 11a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Zm7.25.5a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5ZM3.75 19.25c0-2.9 2.2-5 4.75-5s4.75 2.1 4.75 5v.75H3.75v-.75Zm9.5-.75c0-1.55.42-2.98 1.14-4.13 1.02.7 2.26 1.13 3.61 1.13 1.08 0 2.1-.27 3-.75v4.5h-7.75V18.5Z" />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg className="tab-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM6 19.25C6 16.9 8.24 15 12 15s6 1.9 6 4.25V20H6v-.75Z" />
    </svg>
  )
}

function Layout() {
  const [hasAlerts, setHasAlerts] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadAlerts() {
      try {
        const [friends, trades] = await Promise.all([fetchFriends(), fetchTrades()])
        if (cancelled) return
        const incomingFriends = Boolean(friends.incoming?.length)
        const incomingTrades = (trades.open || []).some((item) => !item.is_initiator)
        setHasAlerts(incomingFriends || incomingTrades)
      } catch {
        if (!cancelled) setHasAlerts(false)
      }
    }
    loadAlerts()
    const handle = setInterval(loadAlerts, 4000)
    return () => {
      cancelled = true
      clearInterval(handle)
    }
  }, [])

  return (
    <div className="app-shell">
      <div className="app-content">
        <Outlet />
      </div>
      <nav className="tab-bar" aria-label="Main">
        <NavLink to="/" end className="tab">
          <HomeIcon />
          <span className="tab-label">Home</span>
          <span className="tab-dot" aria-hidden="true" />
        </NavLink>
        <NavLink
          to="/friends"
          className="tab"
          aria-label={hasAlerts ? 'Friends, new requests' : 'Friends'}
        >
          <span className="tab-icon-wrap">
            <FriendsIcon />
            {hasAlerts ? <span className="tab-badge" aria-hidden="true" /> : null}
          </span>
          <span className="tab-label">Friends</span>
          <span className="tab-dot" aria-hidden="true" />
        </NavLink>
        <NavLink to="/profile" className="tab">
          <ProfileIcon />
          <span className="tab-label">Profile</span>
          <span className="tab-dot" aria-hidden="true" />
        </NavLink>
      </nav>
    </div>
  )
}

export default Layout
