import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  acceptTrade,
  cancelTrade,
  cardImageSrc,
  createTrade,
  fetchCards,
  fetchFriends,
  fetchTrade,
  fetchTrades,
  updateTradeCards,
} from './api'
import PlayerRow from './PlayerRow'
import './Friends.css'
import './Trade.css'
import './Profile.css'

function rarityStars(rarity) {
  if (rarity === 'Legendary') return '★★★★★'
  if (rarity === 'Epic') return '★★★★'
  if (rarity === 'Rare') return '★★★'
  if (rarity === 'Uncommon') return '★★'
  return '★'
}

function TradeCard({ card, selected, disabled, onToggle }) {
  const imageSrc = cardImageSrc(card.image)
  return (
    <li
      className={`trade-card ${selected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`}
      data-rarity={card.rarity}
    >
      <button
        type="button"
        className="blank-card-button"
        disabled={disabled || !onToggle}
        onClick={() => onToggle?.(card)}
      >
        {imageSrc ? <img src={imageSrc} alt="" className="card-full-image" /> : null}
        <div className="card-rarity-stars" aria-label={card.rarity}>
          {Array.from({ length: rarityStars(card.rarity).length }, (_, index) => (
            <span key={index}>★</span>
          ))}
        </div>
      </button>
    </li>
  )
}

function CardStrip({ cards, emptyLabel }) {
  if (!cards.length) {
    return <p className="trade-empty">{emptyLabel}</p>
  }
  return (
    <ul className="trade-card-grid">
      {cards.map((card) => (
        <TradeCard key={card.id} card={card} />
      ))}
    </ul>
  )
}

export default function TradeScreen() {
  const { tradeId } = useParams()
  const [searchParams] = useSearchParams()
  const partnerId = searchParams.get('userId')
  const navigate = useNavigate()
  const [friends, setFriends] = useState([])
  const [trade, setTrade] = useState(null)
  const [collection, setCollection] = useState([])
  const [lockedIds, setLockedIds] = useState(new Set())
  const [selectedIds, setSelectedIds] = useState([])
  const [picking, setPicking] = useState(!tradeId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        if (tradeId) {
          const data = await fetchTrade(tradeId)
          if (!cancelled) {
            setTrade(data)
            setSelectedIds(data.your_cards.map((card) => card.id))
            setPicking(false)
          }
        } else if (partnerId) {
          const open = await fetchTrades()
          const existing = (open.open || open.trades).find(
            (item) => item.status === 'pending' && String(item.partner.id) === String(partnerId),
          )
          if (existing) {
            navigate(`/trades/${existing.id}`, { replace: true })
            return
          }
        } else {
          const list = await fetchFriends()
          if (!cancelled) setFriends(list.friends)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [tradeId, partnerId, navigate])

  useEffect(() => {
    if (!tradeId) {
      return undefined
    }
    let cancelled = false
    const handle = setInterval(() => {
      fetchTrade(tradeId)
        .then((data) => {
          if (cancelled) return
          setTrade(data)
          if (data.status !== 'pending') {
            setPicking(false)
          }
        })
        .catch((err) => {
          if (!cancelled) setError(err.message)
        })
    }, 2500)
    return () => {
      cancelled = true
      clearInterval(handle)
    }
  }, [tradeId])

  useEffect(() => {
    if (!picking && !tradeId && !partnerId) {
      return undefined
    }
    let cancelled = false
    async function loadCards() {
      try {
        const [cards, open] = await Promise.all([fetchCards(), fetchTrades()])
        if (cancelled) return
        const locked = new Set()
        const pending = open.open || open.trades.filter((item) => item.status === 'pending')
        pending.forEach((item) => {
          if (String(item.id) === String(tradeId)) return
          item.your_cards.forEach((card) => locked.add(card.id))
        })
        setCollection(cards)
        setLockedIds(locked)
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    }
    loadCards()
    return () => {
      cancelled = true
    }
  }, [picking, tradeId, partnerId])

  const selectable = useMemo(
    () => collection.filter((card) => !lockedIds.has(card.id) || selectedIds.includes(card.id)),
    [collection, lockedIds, selectedIds],
  )

  function toggleCard(card) {
    if (lockedIds.has(card.id) && !selectedIds.includes(card.id)) {
      return
    }
    setSelectedIds((current) =>
      current.includes(card.id) ? current.filter((id) => id !== card.id) : [...current, card.id],
    )
  }

  async function sendOffer() {
    if (!partnerId) return
    setBusy(true)
    setError('')
    try {
      const created = await createTrade(Number(partnerId), selectedIds)
      navigate(`/trades/${created.id}`, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveCards() {
    if (!trade) return
    setBusy(true)
    setError('')
    try {
      const updated = await updateTradeCards(trade.id, selectedIds)
      setTrade(updated)
      setPicking(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleAccept() {
    if (!trade) return
    setBusy(true)
    setError('')
    try {
      setTrade(await acceptTrade(trade.id))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleCancel() {
    if (!trade) return
    setBusy(true)
    setError('')
    try {
      const updated = await cancelTrade(trade.id)
      setTrade(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const partnerName = trade?.partner?.display_name
  const pickingForNew = Boolean(partnerId) && !tradeId

  return (
    <main className="trade-page">
      <header className="trade-header">
        <button type="button" className="ghost" onClick={() => navigate(-1)}>
          Back
        </button>
        <h1>{trade ? `Trade with ${partnerName}` : 'Trade'}</h1>
      </header>
      {error ? <p className="form-error">{error}</p> : null}

      {!tradeId && !partnerId ? (
        <section>
          <h2>Choose a friend</h2>
          {friends.length ? (
            <ul className="player-list">
              {friends.map((player) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  actionLabel="Trade"
                  onAction={() => navigate(`/trades/new?userId=${player.id}`)}
                />
              ))}
            </ul>
          ) : (
            <p className="trade-empty">Add a friend before you can trade.</p>
          )}
        </section>
      ) : null}

      {(pickingForNew || picking) && (partnerId || trade) ? (
        <section>
          <h2>{pickingForNew ? 'Choose cards to offer' : 'Update your offer'}</h2>
          <p className="trade-note">Select cards from your collection, or send nothing.</p>
          {selectable.length ? (
            <ul className="trade-card-grid">
              {selectable.map((card) => (
                <TradeCard
                  key={card.id}
                  card={card}
                  selected={selectedIds.includes(card.id)}
                  disabled={lockedIds.has(card.id) && !selectedIds.includes(card.id)}
                  onToggle={toggleCard}
                />
              ))}
            </ul>
          ) : (
            <p className="trade-empty">You have no cards available to offer.</p>
          )}
          <div className="trade-actions">
            {pickingForNew ? (
              <button type="button" className="primary" disabled={busy} onClick={sendOffer}>
                {busy ? 'Sending…' : selectedIds.length ? 'Send offer' : 'Send empty offer'}
              </button>
            ) : (
              <>
                <button type="button" className="primary" disabled={busy} onClick={saveCards}>
                  {busy ? 'Saving…' : 'Save offer'}
                </button>
                <button type="button" className="ghost" disabled={busy} onClick={() => setPicking(false)}>
                  Cancel
                </button>
              </>
            )}
          </div>
        </section>
      ) : null}

      {trade && !picking ? (
        <section className="trade-board">
          <p className="trade-status">
            {trade.status === 'completed'
              ? 'Trade complete. Cards have moved.'
              : trade.status === 'cancelled'
                ? 'This trade was cancelled.'
                : trade.you_accepted && trade.they_accepted
                  ? 'Both accepted.'
                  : trade.you_accepted
                    ? `Waiting for ${partnerName} to accept.`
                    : trade.they_accepted
                      ? `${partnerName} accepted. Review the cards and accept when you are ready.`
                      : 'Add or change cards, then both of you need to accept.'}
          </p>
          <div className="trade-columns">
            <div>
              <h2>You offer</h2>
              <CardStrip cards={trade.your_cards} emptyLabel="Nothing offered yet." />
            </div>
            <div>
              <h2>{partnerName} offers</h2>
              <CardStrip cards={trade.their_cards} emptyLabel="Waiting for their cards." />
            </div>
          </div>
          {trade.status === 'pending' ? (
            <div className="trade-actions">
              <button type="button" className="ghost" disabled={busy} onClick={() => setPicking(true)}>
                Change my cards
              </button>
              <button
                type="button"
                className="primary"
                disabled={busy || trade.you_accepted}
                onClick={handleAccept}
              >
                {trade.you_accepted ? 'Accepted' : busy ? 'Please wait…' : 'Accept trade'}
              </button>
              <button type="button" className="ghost" disabled={busy} onClick={handleCancel}>
                Cancel trade
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  )
}
