import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AddCardProvider, useAddCard } from './AddCardContext.jsx'
import { fetchFriends, fetchTrades } from './api'
import HomeLogo from './HomeLogo.jsx'
import './Layout.css'

const TABS = [
  { to: '/', end: true, label: 'Home', Icon: HomeLogo, sliderIndex: 0 },
  { to: '/rooms', label: 'Rooms', Icon: RoomsIcon, sliderIndex: 1 },
  { to: '/friends', label: 'Friends', Icon: FriendsIcon, sliderIndex: 3 },
  { to: '/profile', label: 'Profile', Icon: ProfileIcon, sliderIndex: 4 },
]

function RoomsIcon() {
  return (
    <svg className="tab-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4.5h16v15H4v-15Zm2 2v11h12v-11H6Zm6 3.25a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5Z" />
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

function PlusIcon() {
  return (
    <svg className="tab-fab-plus" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}

function activeSliderIndex(pathname) {
  if (pathname.startsWith('/rooms')) return 1
  if (pathname.startsWith('/friends') || pathname.startsWith('/trades')) return 3
  if (pathname.startsWith('/profile') || pathname.startsWith('/users')) return 4
  return 0
}

function TabBar({ pathname, hasAlerts }) {
  const { openAddCard } = useAddCard()
  const index = activeSliderIndex(pathname)
  const [sliderIndex, setSliderIndex] = useState(index)
  const [skipSlide, setSkipSlide] = useState(false)

  useEffect(() => {
    const crossesPlus = (sliderIndex < 2 && index > 2) || (sliderIndex > 2 && index < 2)
    if (crossesPlus) {
      setSkipSlide(true)
      setSliderIndex(index)
      const handle = requestAnimationFrame(() => setSkipSlide(false))
      return () => cancelAnimationFrame(handle)
    }
    setSliderIndex(index)
    return undefined
  }, [index, sliderIndex])

  return (
    <nav className="tab-bar" aria-label="Main">
      <span
        className={`tab-slider${skipSlide ? ' is-instant' : ''}`}
        style={{ transform: `translateX(${sliderIndex * 100}%)` }}
        aria-hidden="true"
      >
        <span className="tab-slider-circle" />
      </span>
      {TABS.slice(0, 2).map(({ to, end, label, Icon, sliderIndex }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={() => (sliderIndex === index ? 'tab active' : 'tab')}
        >
          <span className="tab-glyph">
            <span className="tab-icon-wrap">
              <Icon />
            </span>
          </span>
          <span className="tab-label">{label}</span>
        </NavLink>
      ))}
      <div className="tab-fab-slot">
        <button type="button" className="tab-fab" aria-label="Add cards" onClick={openAddCard}>
          <PlusIcon />
        </button>
      </div>
      {TABS.slice(2).map(({ to, end, label, Icon, sliderIndex }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={() => (sliderIndex === index ? 'tab active' : 'tab')}
          aria-label={to === '/friends' && hasAlerts ? 'Friends, new requests' : undefined}
        >
          <span className="tab-glyph">
            <span className="tab-icon-wrap">
              <Icon />
              {to === '/friends' && hasAlerts ? <span className="tab-badge" aria-hidden="true" /> : null}
            </span>
          </span>
          <span className="tab-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function Layout() {
  const { pathname } = useLocation()
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
    <AddCardProvider>
      <AppShell pathname={pathname} hasAlerts={hasAlerts} />
    </AddCardProvider>
  )
}

function AppShell({ pathname, hasAlerts }) {
  const { overlayOpen } = useAddCard()
  return (
    <div className={`app-shell${overlayOpen ? ' has-card-overlay' : ''}`}>
      <div className="sky-stars" aria-hidden="true">
        <span className="sky-star s1" />
        <span className="sky-star s2" />
        <span className="sky-star s3" />
        <span className="sky-star s4" />
        <span className="sky-star s5" />
      </div>
      <div className="app-content">
        <Outlet />
      </div>
      <TabBar pathname={pathname} hasAlerts={hasAlerts} />
    </div>
  )
}

export default Layout
