import { Route, Routes } from 'react-router-dom'
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
        <Route path="/" element={<HomeScreen />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
    </Routes>
  )
}

export default App
