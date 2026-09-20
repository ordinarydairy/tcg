import { useEffect, useState } from 'react'
import { useAddCard } from './AddCardContext.jsx'
import { cardImageSrc, donatePackCard, fetchCards, fetchPackStatus, pullPackCard } from './api'
import HomeLogo from './HomeLogo.jsx'
import './Home.css'

function formatRemaining(seconds) {
  if (seconds <= 0) {
    return 'Ready to pull'
  }
  return `${seconds}s until next pull`
}

export default function HomeScreen() {
  const { cardsRevision } = useAddCard()
  const [pack, setPack] = useState(null)
  const [cards, setCards] = useState([])
  const [remaining, setRemaining] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [picking, setPicking] = useState(false)
  const [reveal, setReveal] = useState(null)

  async function refreshPack() {
    const [packData, cardData] = await Promise.all([fetchPackStatus(), fetchCards()])
    setPack(packData)
    setRemaining(packData.remaining_seconds)
    setCards(cardData)
    return packData
  }

  useEffect(() => {
    let cancelled = false
    refreshPack()
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [cardsRevision])

  useEffect(() => {
    if (remaining <= 0) {
      return undefined
    }
    const handle = setTimeout(() => {
      setRemaining((current) => Math.max(0, current - 1))
    }, 1000)
    return () => clearTimeout(handle)
  }, [remaining])

  const credits = pack?.credits ?? 0
  const otherCount = pack?.other_count ?? 0
  const cooldown = pack?.cooldown_seconds || 20
  const coolingDown = remaining > 0
  const canPull = !busy && pack != null && credits > 0 && otherCount > 0 && !coolingDown
  const pulls = pack?.last_opening?.cards || []

  async function handleDonate(card) {
    setError('')
    setBusy(true)
    try {
      const data = await donatePackCard(card.id)
      setPack(data)
      setRemaining(data.remaining_seconds)
      setCards((current) => current.filter((item) => item.id !== card.id))
      setPicking(false)
    } catch (err) {
      setError(err.message)
      try {
        await refreshPack()
      } catch {
        /* keep the original error */
      }
    } finally {
      setBusy(false)
    }
  }

  async function handlePull() {
    setError('')
    setBusy(true)
    try {
      const data = await pullPackCard()
      setPack(data)
      setRemaining(data.remaining_seconds)
      const pulled = data.last_opening?.cards?.[0]
      if (pulled) {
        setReveal(pulled)
      }
      const collection = await fetchCards()
      setCards(collection)
    } catch (err) {
      setError(err.message)
      try {
        await refreshPack()
      } catch {
        /* keep the original error */
      }
    } finally {
      setBusy(false)
    }
  }

  let pullLabel = 'Pull from mystery pack'
  if (busy) {
    pullLabel = 'Working…'
  } else if (coolingDown) {
    pullLabel = formatRemaining(remaining)
  } else if (credits < 1) {
    pullLabel = 'Trade a card in first'
  } else if (otherCount < 1) {
    pullLabel = 'Waiting for other cards'
  }

  return (
    <main className="home-page">
      <section className="mystery-pack">
        <p className="eyebrow">Card pack</p>
        <h1>Mystery box</h1>
        <p className="lede">
          Trade one of your cards into the shared pack. Each trade-in gives you one pull of someone
          else’s card.
        </p>

        <div className="mystery-box">
          <HomeLogo />
          <div className="pack-credits" aria-label={`${credits} trade-in credits`}>
            {credits}
          </div>
        </div>

        <p className="pack-count">
          {otherCount} {otherCount === 1 ? 'card' : 'cards'} from other players
        </p>

        <div className="pack-progress">
          <div className="pack-progress-copy">
            <span>{formatRemaining(remaining)}</span>
            <span>{remaining > 0 ? `${remaining}s` : `${cooldown}s ready`}</span>
          </div>
          <progress className="pack-progress-bar" max={cooldown} value={coolingDown ? remaining : 0}>
            {remaining}s
          </progress>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="pack-actions">
          <button type="button" className="ghost" disabled={busy} onClick={() => setPicking(true)}>
            Trade in a card
          </button>
          <button type="button" className="primary" disabled={!canPull} onClick={handlePull}>
            {pullLabel}
          </button>
        </div>
        {cards.length === 0 ? (
          <p className="pack-hint">Add a card from your profile before you can trade one in.</p>
        ) : null}
      </section>

      {pulls.length ? (
        <section className="pack-reveals">
          <h2>Last pull</h2>
          <ul className="card-grid">
            {pulls.map((card) => (
              <li key={card.id} className="blank-card" data-rarity={card.rarity}>
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

      {picking ? (
        <div className="pack-picker-overlay">
          <div className="pack-picker">
            <div className="pack-picker-header">
              <h2>Choose a card to trade in</h2>
              <button type="button" className="ghost" onClick={() => setPicking(false)}>
                Close
              </button>
            </div>
            {cards.length === 0 ? (
              <p className="pack-hint">You have no cards to donate right now.</p>
            ) : (
              <ul className="card-grid">
                {cards.map((card) => (
                  <li key={card.id}>
                    <button
                      type="button"
                      className="blank-card pack-pick-card"
                      data-rarity={card.rarity}
                      disabled={busy}
                      onClick={() => handleDonate(card)}
                    >
                      <div className="blank-card-art">
                        {cardImageSrc(card.image) ? (
                          <img src={cardImageSrc(card.image)} alt="" />
                        ) : null}
                      </div>
                      <p className="blank-card-rarity">{card.rarity}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {reveal ? (
        <button type="button" className="pack-reveal-overlay" onClick={() => setReveal(null)}>
          <span className="pack-reveal-card" data-rarity={reveal.rarity}>
            {cardImageSrc(reveal.image) ? (
              <img src={cardImageSrc(reveal.image)} alt={reveal.rarity} />
            ) : null}
            <span className="pack-reveal-meta">
              {reveal.rarity}
              {reveal.from_friend ? ` · from ${reveal.from_friend}` : ''}
            </span>
          </span>
        </button>
      ) : null}
    </main>
  )
}
