let csrf = ''

function cookieCsrfToken() {
  const match = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

function formatError(payload, fallback) {
  if (!payload || typeof payload !== 'object') return fallback
  if (typeof payload.detail === 'string') return payload.detail
  if (typeof payload.error === 'string') return payload.error
  if (Array.isArray(payload.non_field_errors) && payload.non_field_errors[0]) {
    return payload.non_field_errors[0]
  }
  const first = Object.values(payload).find((value) => Array.isArray(value) && value[0])
  return first ? first[0] : fallback
}

function csrfToken() {
  return cookieCsrfToken() || csrf
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

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : null
  if (!response.ok) {
    throw new Error(formatError(payload, 'Request failed. Please try again.'))
  }
  if (!payload) {
    throw new Error('Could not reach the API. Try refreshing the page.')
  }
  csrf = cookieCsrfToken() || payload.csrfToken || csrf
  return payload
}

export async function ensureCsrf() {
  await request('/api/auth/csrf/')
}

export function fetchMe() {
  return request('/api/auth/me/')
}

export function updateMe(fields) {
  return request('/api/auth/me/', {
    method: 'PATCH',
    body: fields,
  })
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

export function fetchCards() {
  return request('/api/cards/')
}

export function gradeCard({ image, story }) {
  const body = new FormData()
  body.append('image', image)
  if (story) {
    body.append('story', story)
  }
  return request('/api/grade-photo/', { method: 'POST', body })
}

export function cardImageSrc(image) {
  if (!image) {
    return ''
  }
  if (image.startsWith('http://') || image.startsWith('https://')) {
    try {
      return new URL(image).pathname
    } catch {
      return image
    }
  }
  return image
}

export function fetchFriends() {
  return request('/api/friends/')
}

export function fetchSuggestions() {
  return request('/api/friends/suggestions/')
}

export function searchPlayers(query) {
  return request(`/api/friends/search/?q=${encodeURIComponent(query)}`)
}

export function sendFriendRequest(userId) {
  return request('/api/friends/requests/', {
    method: 'POST',
    body: { user_id: userId },
  })
}

export function removeFriend(userId) {
  return request(`/api/friends/${userId}/`, { method: 'DELETE' })
}

export function fetchPlayer(userId) {
  return request(`/api/users/${userId}/`)
}
