import { useEffect, useState } from 'react'
import { cardImageSrc, fetchPackStatus, openPack } from './api'
import './Home.css'

function formatRemaining(seconds) {
  if (seconds <= 0) {
    return 'Ready to open'
  }
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const leftover = seconds % 60
  if (hours > 0) {
    return `${hours}h ${minutes}m left`
  }
  if (minutes > 0) {
    return `${minutes}m ${leftover}s left`
  }
  return `${leftover}s left`
}

export default function HomeScreen() {
  const [pack, setPack] = useState(null)
  const [remaining, setRemaining] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchPackStatus()
      .then((data) => {
        if (cancelled) return
        setPack(data)
        setRemaining(data.remaining_seconds)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (remaining <= 0) {
      return undefined
    }
    const handle = setTimeout(() => {
      setRemaining((current) => Math.max(0, current - 1))
    }, 1000)
    return () => clearTimeout(handle)
  }, [remaining])

  const cooldown = pack?.cooldown_seconds || 7200
  const progress = remaining <= 0 ? 1 : (cooldown - remaining) / cooldown
  const ready = remaining <= 0 && pack?.ready !== false
  const pulls = pack?.last_opening?.cards || []

  async function handleOpen() {
    setError('')
    setBusy(true)
    try {
      const data = await openPack()
      setPack(data)
      setRemaining(data.remaining_seconds)
    } catch (err) {
      setError(err.message)
      try {
        const data = await fetchPackStatus()
        setPack(data)
        setRemaining(data.remaining_seconds)
      } catch {
        /* keep the original error */
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="home-page">
      <section className="mystery-pack">
        <p className="eyebrow">Card pack</p>
        <h1>Mystery box</h1>
        <p className="lede">
          Open a pack of up to 3 random cards from friends. Copies land in your collection, then the box needs 2 hours
          to refill.
        </p>

        <div className="mystery-box" aria-hidden="true">
          <div className="mystery-box-lid" />
          <div className="mystery-box-body">?</div>
        </div>

        <div className="pack-progress">
          <div className="pack-progress-copy">
            <span>{formatRemaining(remaining)}</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <progress className="pack-progress-bar" max={1} value={progress}>
            {Math.round(progress * 100)}%
          </progress>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <button
          type="button"
          className="primary"
          disabled={busy || !ready || pack == null}
          onClick={handleOpen}
        >
          {busy ? 'Opening…' : ready ? 'Open mystery pack' : 'Pack cooling down'}
        </button>
        {pack && pack.friend_count === 0 ? (
          <p className="pack-hint">Add friends first — packs pull from their collections.</p>
        ) : null}
        {pack && pack.friend_count > 0 && pack.pool_size === 0 ? (
          <p className="pack-hint">Your friends have not uploaded cards yet.</p>
        ) : null}
      </section>

      {pulls.length ? (
        <section className="pack-reveals">
          <h2>Last pack</h2>
          <ul className="card-grid">
            {pulls.map((card) => (
              <li key={card.id} className="blank-card">
                <div className="blank-card-art">
                  {cardImageSrc(card.image) ? (
                    <img src={cardImageSrc(card.image)} alt="" />
                  ) : null}
                </div>
                <p className="blank-card-rarity">{card.rarity}</p>
                <p className="pack-from">From {card.from_friend}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  )
}
