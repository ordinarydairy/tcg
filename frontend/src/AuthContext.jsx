/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { ensureCsrf, fetchMe, login as loginRequest, logout as logoutRequest, register as registerRequest, updateMe as updateMeRequest } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function boot() {
      try {
        await ensureCsrf()
        const data = await fetchMe()
        if (!cancelled) setUser(data.user)
      } catch {
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    boot()
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      async login(email, password) {
        const nextUser = await loginRequest(email, password)
        setUser(nextUser)
        return nextUser
      },
      async register(payload) {
        const nextUser = await registerRequest(payload)
        setUser(nextUser)
        return nextUser
      },
      async logout() {
        try {
          await logoutRequest()
        } finally {
          await ensureCsrf()
          setUser(null)
        }
      },
      async updateProfile(fields) {
        const data = await updateMeRequest(fields)
        setUser(data.user)
        return data.user
      },
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
