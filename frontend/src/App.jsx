import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './AuthContext'
import AuthScreen from './AuthScreen'
import HomeScreen from './HomeScreen'
import Layout from './Layout.jsx'
import Profile from './Profile.jsx'
import './App.css'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <main className="auth-page">
        <p className="lede">Loading…</p>
      </main>
    )
  }

  if (!user) {
    return <AuthScreen />
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/profile" replace />} />
        <Route path="profile" element={<Profile />} />
        <Route path="home" element={<HomeScreen />} />
      </Route>
    </Routes>
  )
}

export default App
