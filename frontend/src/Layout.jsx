import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'
import './Layout.css'

function Layout() {
  const { logout } = useAuth()

  return (
    <>
      <header className="site-header">
        <nav className="site-nav" aria-label="Main">
          <NavLink to="/profile">Profile</NavLink>
          <NavLink to="/home">Play</NavLink>
        </nav>
        <button type="button" className="ghost" onClick={() => logout()}>
          Sign out
        </button>
      </header>
      <Outlet />
    </>
  )
}

export default Layout
