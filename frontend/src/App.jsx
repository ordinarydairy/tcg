import { useAuth } from './AuthContext'
import AuthScreen from './AuthScreen'
import HomeScreen from './HomeScreen'
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

  return user ? <HomeScreen /> : <AuthScreen />
}

export default App
