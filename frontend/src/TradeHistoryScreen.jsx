import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchTrades } from './api'
import PlayerRow from './PlayerRow'
import './Friends.css'
import './Trade.css'

function tradeLabel(item) {
  if (item.status === 'completed') return 'Completed'
  if (item.status === 'cancelled') return 'Cancelled'
  if (item.they_accepted && !item.you_accepted) return 'Review'
  return 'Open'
}

export default function TradeHistoryScreen() {
  const navigate = useNavigate()
  const [open, setOpen] = useState([])
  const [history, setHistory] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchTrades()
      .then((payload) => {
        if (cancelled) return
        setOpen(payload.open || payload.trades.filter((item) => item.status === 'pending'))
        setHistory(payload.history || payload.trades.filter((item) => item.status !== 'pending'))
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const trades = [...open, ...history]

  return (
    <main className="trade-page">
      <header className="trade-header">
        <button type="button" className="ghost" onClick={() => navigate('/friends')}>
          Back
        </button>
        <h1>All trades</h1>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      {trades.length ? (
        <ul className="player-list">
          {trades.map((item) => (
            <PlayerRow
              key={item.id}
              player={item.partner}
              actionLabel={tradeLabel(item)}
              onAction={() => navigate(`/trades/${item.id}`)}
            />
          ))}
        </ul>
      ) : (
        <p className="trade-empty">No trades yet.</p>
      )}
    </main>
  )
}
