function csrfToken() {
  const match = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

function formatError(payload, fallback) {
  if (!payload || typeof payload !== 'object') return fallback
  if (typeof payload.detail === 'string') return payload.detail
  if (Array.isArray(payload.non_field_errors) && payload.non_field_errors[0]) {
    return payload.non_field_errors[0]
  }
  const first = Object.values(payload).find((value) => Array.isArray(value) && value[0])
  return first ? first[0] : fallback
}

async function request(path, { method = 'GET', body, headers } = {}) {
  const isFormData = body instanceof FormData
  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers: {
      'X-CSRFToken': csrfToken(),
      ...(isFormData || !body ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: isFormData || !body ? body : JSON.stringify(body),
  })

  if (response.status === 204) return null

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(formatError(payload, 'Request failed. Please try again.'))
  }
  return payload
}

export async function ensureCsrf() {
  await request('/api/auth/csrf/')
}

export function fetchMe() {
  return request('/api/auth/me/')
}

export function login(email, password) {
  return request('/api/auth/login/', {
    method: 'POST',
    body: { email, password },
  })
}

export function register({ email, password, displayName, photo }) {
  const body = new FormData()
  body.append('email', email)
  body.append('password', password)
  body.append('display_name', displayName)
  if (photo) body.append('profile_photo', photo)
  return request('/api/auth/register/', { method: 'POST', body })
}

export function logout() {
  return request('/api/auth/logout/', { method: 'POST' })
}
