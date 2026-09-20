import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchFriends,
  fetchSuggestions,
  fetchTrades,
  removeFriend,
  searchPlayers,
  sendFriendRequest,
} from './api'
import PlayerRow, { friendshipActionLabel } from './PlayerRow'
import './Friends.css'

export default function FriendsScreen() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [friends, setFriends] = useState([])
  const [incoming, setIncoming] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [trades, setTrades] = useState([])
  const [tradeHistory, setTradeHistory] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [searching, setSearching] = useState(false)
  const [listsReady, setListsReady] = useState(false)
  const [error, setError] = useState('')

  function applyTrades(payload) {
    setTrades(payload.open || payload.trades.filter((item) => item.status === 'pending'))
    setTradeHistory(payload.history || payload.trades.filter((item) => item.status !== 'pending'))
  }

  async function loadLists() {
    const [list, suggested, openTrades] = await Promise.all([
      fetchFriends(),
      fetchSuggestions(),
      fetchTrades(),
    ])
    setFriends(list.friends)
    setIncoming(list.incoming)
    setSuggestions(suggested.users)
    applyTrades(openTrades)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [list, suggested, openTrades] = await Promise.all([
          fetchFriends(),
          fetchSuggestions(),
          fetchTrades(),
        ])
        if (cancelled) return
        setFriends(list.friends)
        setIncoming(list.incoming)
        setSuggestions(suggested.users)
        setTrades(openTrades.open || openTrades.trades.filter((item) => item.status === 'pending'))
        setTradeHistory(openTrades.history || openTrades.trades.filter((item) => item.status !== 'pending'))
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setListsReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const handle = setInterval(() => {
      fetchTrades()
        .then((openTrades) => {
          setTrades(openTrades.open || openTrades.trades.filter((item) => item.status === 'pending'))
          setTradeHistory(openTrades.history || openTrades.trades.filter((item) => item.status !== 'pending'))
        })
        .catch(() => {})
    }, 4000)
    return () => clearInterval(handle)
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
        <div className="friends-header-row">
          <h1>Friends</h1>
          <button type="button" className="ghost friends-header-trade" onClick={() => navigate('/trades/new')}>
            Trade
          </button>
        </div>
        <label className="friends-search">
          Search players
          <input
            type="search"
            value={query}
            placeholder="Search by name or player ID"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </header>

      {error ? <p className="form-error">{error}</p> : null}

      {trades.length ? (
        <section className="friends-section">
          <h2>Open trades</h2>
          <ul className="player-list">
            {trades.map((item) => (
              <PlayerRow
                key={item.id}
                player={item.partner}
                actionLabel={item.they_accepted && !item.you_accepted ? 'Review' : 'Open'}
                onAction={() => navigate(`/trades/${item.id}`)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {tradeHistory.length ? (
        <section className="friends-section">
          <div className="friends-section-heading">
            <h2>Recent trades</h2>
            {tradeHistory.length > 3 ? (
              <button type="button" className="ghost friends-see-all" onClick={() => navigate('/trades/history')}>
                See all
              </button>
            ) : null}
          </div>
          <ul className="player-list">
            {tradeHistory.slice(0, 3).map((item) => (
              <PlayerRow
                key={item.id}
                player={item.partner}
                actionLabel={item.status === 'completed' ? 'Completed' : 'Cancelled'}
                actionTone={item.status === 'completed' ? 'completed' : 'cancelled'}
                onAction={() => navigate(`/trades/${item.id}`)}
              />
            ))}
          </ul>
        </section>
      ) : null}

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
              {searching ? 'Searching…' : 'No players match that name or ID.'}
            </p>
          )}
        </section>
      ) : null}

      <section className="friends-section">
        <h2>Your friends</h2>
        {!listsReady ? (
          <p className="friends-loading" role="status">Loading friends…</p>
        ) : friends.length ? (
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
        {!listsReady ? (
          <p className="friends-loading" role="status">Loading suggestions…</p>
        ) : suggestions.length ? (
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

      {incoming.length ? (
        <section className="friends-section">
          <h2>Pending requests</h2>
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
    </main>
  )
}
