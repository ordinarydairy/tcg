import { useEffect, useState } from 'react'
import {
  fetchFriends,
  fetchSuggestions,
  removeFriend,
  searchPlayers,
  sendFriendRequest,
} from './api'
import PlayerRow, { friendshipActionLabel } from './PlayerRow'
import './Friends.css'

export default function FriendsScreen() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [friends, setFriends] = useState([])
  const [incoming, setIncoming] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  async function loadLists() {
    const [list, suggested] = await Promise.all([fetchFriends(), fetchSuggestions()])
    setFriends(list.friends)
    setIncoming(list.incoming)
    setSuggestions(suggested.users)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [list, suggested] = await Promise.all([fetchFriends(), fetchSuggestions()])
        if (cancelled) return
        setFriends(list.friends)
        setIncoming(list.incoming)
        setSuggestions(suggested.users)
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setSearching(false)
      return undefined
    }
    setSearching(true)
    const handle = setTimeout(() => {
      searchPlayers(trimmed)
        .then((data) => setResults(data.users))
        .catch((err) => setError(err.message))
        .finally(() => setSearching(false))
    }, 250)
    return () => clearTimeout(handle)
  }, [query])

  async function handleAction(player) {
    setError('')
    setBusyId(player.id)
    try {
      if (player.friendship_status === 'friends') {
        await removeFriend(player.id)
      } else {
        await sendFriendRequest(player.id)
      }
      await loadLists()
      if (query.trim()) {
        const data = await searchPlayers(query.trim())
        setResults(data.users)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className="friends-page">
      <header className="friends-header">
        <h1>Friends</h1>
        <label className="friends-search">
          Search players
          <input
            type="search"
            value={query}
            placeholder="Search by display name"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </header>

      {error ? <p className="form-error">{error}</p> : null}

      {query.trim() ? (
        <section className="friends-section">
          <h2>Search results</h2>
          {results.length ? (
            <ul className="player-list">
              {results.map((player) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  actionLabel={friendshipActionLabel(player.friendship_status)}
                  actionBusy={busyId === player.id}
                  onAction={handleAction}
                />
              ))}
            </ul>
          ) : (
            <p className="friends-empty">
              {searching ? 'Searching…' : 'No players match that name.'}
            </p>
          )}
        </section>
      ) : null}

      {incoming.length ? (
        <section className="friends-section">
          <h2>Friend requests</h2>
          <ul className="player-list">
            {incoming.map((player) => (
              <PlayerRow
                key={player.id}
                player={player}
                actionLabel="Accept"
                actionBusy={busyId === player.id}
                onAction={handleAction}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="friends-section">
        <h2>Your friends</h2>
        {friends.length ? (
          <ul className="player-list">
            {friends.map((player) => (
              <PlayerRow key={player.id} player={player} />
            ))}
          </ul>
        ) : (
          <p className="friends-empty">No friends yet. Send a request below.</p>
        )}
      </section>

      <section className="friends-section">
        <h2>Suggested friends</h2>
        {suggestions.length ? (
          <ul className="player-list">
            {suggestions.map((player) => (
              <PlayerRow
                key={player.id}
                player={player}
                actionLabel="Add friend"
                actionBusy={busyId === player.id}
                onAction={handleAction}
              />
            ))}
          </ul>
        ) : (
          <p className="friends-empty">No other players to suggest yet.</p>
        )}
      </section>
    </main>
  )
}
