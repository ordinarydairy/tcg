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

export function fetchCards(userId) {
  const query = userId ? `?user_id=${encodeURIComponent(userId)}` : ''
  return request(`/api/cards/${query}`)
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

export function fetchPackStatus() {
  return request('/api/pack/')
}

export function donatePackCard(cardId) {
  return request('/api/pack/donate/', {
    method: 'POST',
    body: { card_id: cardId },
  })
}

export function pullPackCard() {
  return request('/api/pack/pull/', { method: 'POST' })
}

export function fetchTrades() {
  return request('/api/trades/')
}

export function createTrade(userId, cardIds = []) {
  return request('/api/trades/', {
    method: 'POST',
    body: { user_id: userId, card_ids: cardIds },
  })
}

export function fetchTrade(tradeId) {
  return request(`/api/trades/${tradeId}/`)
}

export function updateTradeCards(tradeId, cardIds) {
  return request(`/api/trades/${tradeId}/`, {
    method: 'PATCH',
    body: { card_ids: cardIds },
  })
}

export function acceptTrade(tradeId) {
  return request(`/api/trades/${tradeId}/accept/`, { method: 'POST' })
}

export function cancelTrade(tradeId) {
  return request(`/api/trades/${tradeId}/cancel/`, { method: 'POST' })
}

export function createRoom(cardIds = []) {
  return request('/api/rooms/', {
    method: 'POST',
    body: { card_ids: cardIds },
  })
}

export function joinRoom(code, cardIds = []) {
  return request('/api/rooms/join/', {
    method: 'POST',
    body: { code, card_ids: cardIds },
  })
}

export function fetchRoom(code) {
  return request(`/api/rooms/${encodeURIComponent(code)}/`)
}

export function leaveRoom(code) {
  return request(`/api/rooms/${encodeURIComponent(code)}/leave/`, {
    method: 'DELETE',
  })
}

export function startMeeting(code) {
  return request(`/api/rooms/${encodeURIComponent(code)}/start/`, {
    method: 'POST',
  })
}

export function fetchCurrentRoom() {
  return request('/api/rooms/current/')
}

export function fetchCurrentExchange(code) {
  return request(
    `/api/rooms/${encodeURIComponent(code)}/exchange/`
  )
}

export function submitIcebreaker(code, answer) {
  return request(
    `/api/rooms/${encodeURIComponent(code)}/exchange/answer/`,
    {
      method: 'POST',
      body: { answer },
    }
  )
}

export function voteExchangeTrade(code, wantsTrade) {
  return request(
    `/api/rooms/${encodeURIComponent(code)}/exchange/trade-vote/`,
    {
      method: 'POST',
      body: { wants_trade: wantsTrade },
    }
  )
}

export function addExchangeCard(code, cardId) {
  return request(
    `/api/rooms/${encodeURIComponent(code)}/exchange/add-card/`,
    {
      method: 'POST',
      body: { card_id: cardId },
    }
  )
}

export function readyNextRound(code) {
  return request(
    `/api/rooms/${encodeURIComponent(code)}/exchange/ready/`,
    { method: 'POST' }
  )
}

export function endRoomGame(code) {
  return request(
    `/api/rooms/${encodeURIComponent(code)}/end-game/`,
    { method: 'POST' }
  )
}