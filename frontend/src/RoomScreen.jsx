import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './AuthContext'
import {
  createRoom as createRoomApi,
  joinRoom as joinRoomApi,
  fetchRoom,
  fetchCurrentRoom,
  fetchCurrentExchange,
  fetchCards,
  leaveRoom as leaveRoomApi,
  startMeeting as startMeetingApi,
  submitIcebreaker,
  voteExchangeTrade,
  addExchangeCard,
  readyNextRound,
  endRoomGame,
  sendFriendRequest,
  cardImageSrc,
} from './api'
import PlayerRow, { friendshipActionLabel } from './PlayerRow'
import './Rooms.css'
import './Trade.css'
import './App.css'
import './Profile.css'
import './Friends.css'

const MAX_DECK_CARDS = 3

function rarityStarCount(rarity) {
  if (rarity === 'Legendary') return 5
  if (rarity === 'Epic') return 4
  if (rarity === 'Rare') return 3
  if (rarity === 'Uncommon') return 2
  return 1
}

function mapRoom(room) {
  return {
    code: room.code,
    isHost: room.is_host,
    host: room.host,
    hostCards: room.host_cards || [],
    members: room.members || [],
    meetingStarted: room.meeting_started,
    gameOver: room.game_over,
  }
}

function MiniCard({ card, label, onPreview }) {
  if (!card) return null
  const imageSrc = cardImageSrc(card.image)
  return (
    <button
      type="button"
      className="rooms-mini-card"
      data-rarity={card.rarity}
      onClick={() => onPreview?.(card)}
      aria-label={label ? `Preview ${label}` : 'Preview card'}
    >
      {imageSrc ? <img src={imageSrc} alt="" /> : <span />}
      <div className="card-rarity-stars" aria-label={card.rarity || 'Common'}>
        {Array.from({ length: rarityStarCount(card.rarity) }, (_, index) => (
          <span key={index}>★</span>
        ))}
      </div>
      {label ? <p className="rooms-mini-card-label">{label}</p> : null}
    </button>
  )
}

function CardPreviewModal({ card, flipped, onToggleFlip, onClose }) {
  if (!card) return null
  const imageSrc = cardImageSrc(card.image)

  return (
    <div
      className="card-upload-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="card-flip-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Card preview"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={`card-flip ${flipped ? 'is-flipped' : ''}`}
          onClick={onToggleFlip}
        >
          <div className="card-flip-inner">
            <div className="card-face card-front light" data-rarity={card.rarity}>
              {imageSrc ? (
                <img src={imageSrc} alt="" className="card-full-image" />
              ) : null}
              <div className="card-rarity-stars" aria-label={card.rarity}>
                {Array.from({ length: rarityStarCount(card.rarity) }, (_, index) => (
                  <span key={index}>★</span>
                ))}
              </div>
            </div>

            <div className="card-face card-back light" data-rarity={card.rarity}>
              {imageSrc ? (
                <img src={imageSrc} alt="" className="card-back-image" />
              ) : null}
              <div className="card-back-overlay" />
              <div className="card-back-content">
                <div className="card-back-info">
                  <p className="card-back-rarity">{card.rarity}</p>
                  <p className="card-back-username">
                    {card.creator_display_name || 'Player'}
                    {card.creator_tag ? ` #${card.creator_tag}` : ''}
                  </p>
                  {card.story?.trim() ? (
                    <p className="card-back-description">{card.story}</p>
                  ) : (
                    <p className="card-back-description">No description on this card.</p>
                  )}
                  <div className="card-score-area">
                    <span className="card-score-value">
                      {card.overall_score ?? 0}/100
                    </span>
                  </div>
                </div>
                <div className="card-rarity-stars" aria-label={card.rarity}>
                  {Array.from({ length: rarityStarCount(card.rarity) }, (_, index) => (
                    <span key={index}>★</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="card-flip-hint">Click card to flip</p>
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}

function DeckPreview({ cards }) {
  if (!cards?.length) {
    return <p className="rooms-deck-empty">No cards brought.</p>
  }

  return (
    <ul className="rooms-lobby-deck">
      {cards.map((card) => {
        const imageSrc = cardImageSrc(card.image)
        return (
          <li key={card.id} className="rooms-lobby-deck-card" data-rarity={card.rarity}>
            {imageSrc ? <img src={imageSrc} alt="" /> : <span />}
            <div className="card-rarity-stars" aria-label={card.rarity || 'Common'}>
              {Array.from({ length: rarityStarCount(card.rarity) }, (_, index) => (
                <span key={index}>★</span>
              ))}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default function RoomScreen() {
  const { user } = useAuth()

  const [roomCode, setRoomCode] = useState('')
  const [activeRoom, setActiveRoom] = useState(null)
  const [joinCode, setJoinCode] = useState('')
  const [roomNotice, setRoomNotice] = useState('')
  const [entryStep, setEntryStep] = useState('start')
  const [pendingAction, setPendingAction] = useState(null)
  const [ownedCards, setOwnedCards] = useState([])
  const [selectedDeckIds, setSelectedDeckIds] = useState([])
  const [deckBusy, setDeckBusy] = useState(false)
  const [cardsLoading, setCardsLoading] = useState(false)
  const [collectionCount, setCollectionCount] = useState(null)
  const [visibleDecks, setVisibleDecks] = useState(() => new Set())
  const [exchange, setExchange] = useState(null)
  const [icebreakerAnswer, setIcebreakerAnswer] = useState(() => {
    return sessionStorage.getItem('icebreakerDraft') || ''
  })
  const [gameBusy, setGameBusy] = useState(false)
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [sittingOut, setSittingOut] = useState(false)
  const [waitingForRematch, setWaitingForRematch] = useState(false)
  const [playedWith, setPlayedWith] = useState([])
  const [friendBusyId, setFriendBusyId] = useState(null)
  const [previewCard, setPreviewCard] = useState(null)
  const [previewFlipped, setPreviewFlipped] = useState(false)

  const canUseRooms = collectionCount > 0

  function openCardPreview(card) {
    setPreviewCard(card)
    setPreviewFlipped(false)
  }

  function closeCardPreview() {
    setPreviewCard(null)
    setPreviewFlipped(false)
  }

  useEffect(() => {
    if (!user?.id) return

    let cancelled = false
    async function loadCollection() {
      try {
        const cards = await fetchCards(user.id)
        const list = cards.cards || cards
        if (!cancelled) {
          setCollectionCount(list.length)
        }
      } catch {
        if (!cancelled) {
          setCollectionCount(0)
        }
      }
    }

    loadCollection()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  useEffect(() => {
    async function restoreRoom() {
      try {
        const data = await fetchCurrentRoom()

        if (!data.room) {
          return
        }

        setActiveRoom(mapRoom(data.room))
        setRoomCode(data.room.code)
      } catch (error) {
        console.error('Could not restore room:', error)
      }
    }

    restoreRoom()
  }, [])


  useEffect(() => {
  if (!activeRoom?.code) {
    return
  }

  async function refreshRoom() {
    try {
      const room = await fetchRoom(activeRoom.code)

      setActiveRoom(mapRoom(room))
    } catch (error) {
      console.error('Could not refresh room:', error)

      setActiveRoom(null)
      setRoomCode('')
      setJoinCode('')
      setVisibleDecks(new Set())
      setRoomNotice('The host has ended the room.')
    }
  }

  refreshRoom()

  const interval = setInterval(refreshRoom, 2000)

  return () => {
    clearInterval(interval)
  }
}, [activeRoom?.code])
useEffect(() => {
  if (!activeRoom?.meetingStarted || !activeRoom?.code) {
    setExchange(null)
    return
  }

  let interval

  async function loadExchange() {
    try {
      const data = await fetchCurrentExchange(activeRoom.code)

      if (data.game_over) {
        setGameOver(true)
      }

      setSittingOut(Boolean(data.sitting_out))
      setWaitingForRematch(Boolean(data.waiting_for_rematch))
      if (Array.isArray(data.played_with)) {
        setPlayedWith(data.played_with)
      }

      if (!data.exchange) {
        setExchange(null)
        return
      }

      setExchange((current) => {
        if (current?.id !== data.exchange.id) {
          if (data.exchange.answer_submitted) {
            setIcebreakerAnswer(data.exchange.my_answer || '')
          } else {
            setIcebreakerAnswer(sessionStorage.getItem('icebreakerDraft') || '')
          }
        }
        return data.exchange
      })
    } catch (error) {
      console.error('Could not load exchange:', error)
    }
  }

  loadExchange()

  interval = setInterval(loadExchange, 2000)

  return () => {
    clearInterval(interval)
  }
}, [activeRoom?.meetingStarted, activeRoom?.code])

  async function beginCreateRoom() {
    if (!canUseRooms) {
      setRoomNotice('Add at least one card to your collection before using rooms.')
      return
    }
    setRoomNotice('')
    setPendingAction('create')
    setSelectedDeckIds([])
    setEntryStep('pick-cards')
    setCardsLoading(true)
    try {
      const cards = await fetchCards(user.id)
      const list = cards.cards || cards
      setOwnedCards(list)
      if (!list.length) {
        setCollectionCount(0)
        setEntryStep('start')
        setPendingAction(null)
        setRoomNotice('Add at least one card to your collection before using rooms.')
      }
    } catch (error) {
      setRoomNotice(error.message || 'Could not load your cards.')
      setEntryStep('start')
      setPendingAction(null)
    } finally {
      setCardsLoading(false)
    }
  }

  async function beginJoinRoom(event) {
    event?.preventDefault?.()
    setRoomNotice('')

    if (!canUseRooms) {
      setRoomNotice('Add at least one card to your collection before using rooms.')
      return
    }

    const code = joinCode.trim()

    if (!/^\d{4}$/.test(code)) {
      setRoomNotice('Enter a 4-digit room code.')
      return
    }

    setPendingAction('join')
    setSelectedDeckIds([])
    setEntryStep('pick-cards')
    setCardsLoading(true)
    try {
      const cards = await fetchCards(user.id)
      const list = cards.cards || cards
      setOwnedCards(list)
      if (!list.length) {
        setCollectionCount(0)
        setEntryStep('start')
        setPendingAction(null)
        setRoomNotice('Add at least one card to your collection before using rooms.')
      }
    } catch (error) {
      setRoomNotice(error.message || 'Could not load your cards.')
      setEntryStep('start')
      setPendingAction(null)
    } finally {
      setCardsLoading(false)
    }
  }

  function toggleDeckCard(cardId) {
    setSelectedDeckIds((current) => {
      if (current.includes(cardId)) {
        return current.filter((id) => id !== cardId)
      }
      if (current.length >= MAX_DECK_CARDS) {
        setRoomNotice(`Pick up to ${MAX_DECK_CARDS} cards.`)
        return current
      }
      setRoomNotice('')
      return [...current, cardId]
    })
  }

  function cancelDeckPick() {
    setEntryStep('start')
    setPendingAction(null)
    setSelectedDeckIds([])
    setOwnedCards([])
    setRoomNotice('')
  }

  function toggleDeckVisibility(userId) {
    setVisibleDecks((current) => {
      const next = new Set(current)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  async function confirmDeckPick() {
    if (selectedDeckIds.length < 1) {
      setRoomNotice('Select at least 1 card.')
      return
    }
    if (selectedDeckIds.length > MAX_DECK_CARDS) {
      setRoomNotice(`Pick up to ${MAX_DECK_CARDS} cards.`)
      return
    }

    setDeckBusy(true)
    setRoomNotice('')
    try {
      const room =
        pendingAction === 'create'
          ? await createRoomApi(selectedDeckIds)
          : await joinRoomApi(joinCode.trim(), selectedDeckIds)

      setRoomCode(room.code)
      setActiveRoom(mapRoom(room))
      setEntryStep('start')
      setPendingAction(null)
      setSelectedDeckIds([])
      setOwnedCards([])
      setVisibleDecks(new Set())
    } catch (error) {
      setRoomNotice(error.message || 'Could not enter the room.')
    } finally {
      setDeckBusy(false)
    }
  }

  async function startMeeting() {
    if (!activeRoom) return

    setGameBusy(true)
    setRoomNotice('')
    try {
      await startMeetingApi(activeRoom.code)

      setGameOver(false)
      setActiveRoom((current) => ({
        ...current,
        meetingStarted: true,
        gameOver: false,
      }))
      setVisibleDecks(new Set())
    } catch (error) {
      setRoomNotice(error.message || 'Could not start meeting.')
    } finally {
      setGameBusy(false)
    }
  }

  async function submitAnswer() {
    const answer = icebreakerAnswer.trim()

    if (!answer || !activeRoom || gameBusy) {
      return
    }

    setGameBusy(true)
    try {
      const data = await submitIcebreaker(activeRoom.code, answer)
      if (data.exchange) {
        setExchange(data.exchange)
      }
      sessionStorage.removeItem('icebreakerDraft')
    } catch (error) {
      setRoomNotice(error.message || 'Could not submit answer.')
    } finally {
      setGameBusy(false)
    }
  }

  async function voteTrade(wantsTrade) {
    if (!activeRoom || gameBusy) return
    setGameBusy(true)
    try {
      const data = await voteExchangeTrade(activeRoom.code, wantsTrade)
      if (data.exchange) setExchange(data.exchange)
      if (data.game_over) setGameOver(true)
      if (Array.isArray(data.played_with)) {
        setPlayedWith(data.played_with)
      }
    } catch (error) {
      setRoomNotice(error.message || 'Could not submit trade vote.')
    } finally {
      setGameBusy(false)
    }
  }

  async function handleAddCard(cardId) {
    if (!activeRoom || gameBusy) return
    setGameBusy(true)
    try {
      const data = await addExchangeCard(activeRoom.code, cardId)
      if (data.exchange) setExchange(data.exchange)
    } catch (error) {
      setRoomNotice(error.message || 'Could not add card.')
    } finally {
      setGameBusy(false)
    }
  }

  async function handleReadyNext() {
    if (!activeRoom || gameBusy) return
    setGameBusy(true)
    try {
      const data = await readyNextRound(activeRoom.code)
      if (data.game_over) setGameOver(true)
      if (Array.isArray(data.played_with)) {
        setPlayedWith(data.played_with)
      }
      setSittingOut(Boolean(data.sitting_out))
      setWaitingForRematch(Boolean(data.waiting_for_rematch))
      setExchange(data.exchange || null)
      if (data.exchange && !data.exchange.answer_submitted) {
        setIcebreakerAnswer('')
        sessionStorage.removeItem('icebreakerDraft')
      }
    } catch (error) {
      setRoomNotice(error.message || 'Could not continue.')
    } finally {
      setGameBusy(false)
    }
  }

  async function handleEndGame() {
    if (!activeRoom || gameBusy) return
    setGameBusy(true)
    try {
      const data = await endRoomGame(activeRoom.code)
      setGameOver(true)
      setExchange(null)
      if (Array.isArray(data.played_with)) {
        setPlayedWith(data.played_with)
      }
    } catch (error) {
      setRoomNotice(error.message || 'Could not end the game.')
    } finally {
      setGameBusy(false)
    }
  }

  async function handleAddPlayedFriend(player) {
    if (!player?.id || friendBusyId) return
    setFriendBusyId(player.id)
    try {
      const updated = await sendFriendRequest(player.id)
      setPlayedWith((current) =>
        current.map((entry) =>
          entry.id === player.id
            ? { ...entry, friendship_status: updated.friendship_status }
            : entry,
        ),
      )
    } catch (error) {
      setRoomNotice(error.message || 'Could not send friend request.')
    } finally {
      setFriendBusyId(null)
    }
  }

  async function leaveRoom() {
    if (!activeRoom) return

    try {
      const wasHost = activeRoom.isHost

      await leaveRoomApi(activeRoom.code)

      setActiveRoom(null)
      setRoomCode('')
      setJoinCode('')
      setEntryStep('start')
      setPendingAction(null)
      setSelectedDeckIds([])
      setOwnedCards([])
      setVisibleDecks(new Set())
      setLeaveConfirmOpen(false)
      setGameOver(false)
      setSittingOut(false)
      setWaitingForRematch(false)
      setPlayedWith([])
      setFriendBusyId(null)

      setExchange(null)

      setIcebreakerAnswer('')
      sessionStorage.removeItem('icebreakerDraft')

      if (wasHost) {
        setRoomNotice('Room canceled.')
      }
    } catch (error) {
      console.error('Could not leave room:', error)
    }
  }

  if (activeRoom?.meetingStarted) {
  const leaveLabel = activeRoom.isHost ? 'End Meeting' : 'Leave Meeting'
  const confirmTitle = activeRoom.isHost ? 'End this meeting?' : 'Leave this meeting?'
  const confirmBody = activeRoom.isHost
    ? 'This will close the room for everyone.'
    : 'You’ll leave the room and can rejoin with the code if it’s still open.'
  const showGameOver = gameOver || activeRoom.gameOver || exchange?.game_over

  return (
    <main className={`rooms-page${showGameOver ? ' rooms-page--game-over' : ''}`}>
      {showGameOver ? (
        <section className="rooms-game-over">
          <h1>Game over</h1>
          <p>
            This exchange has ended — someone ran out of playable cards, or a player chose to stop.
          </p>

          {playedWith.length ? (
            <div className="rooms-played-with">
              <h2>Add friends from this game</h2>
              <p className="rooms-lede">
                Stay connected with the people you just played with.
              </p>
              <ul className="player-list rooms-played-with-list">
                {playedWith.map((player) => {
                  const status = player.friendship_status
                  const label = friendshipActionLabel(status)
                  const canAct = status !== 'friends' && status !== 'pending_sent'
                  return (
                    <PlayerRow
                      key={player.id}
                      player={player}
                      actionLabel={label}
                      actionBusy={friendBusyId === player.id}
                      onAction={canAct ? handleAddPlayedFriend : undefined}
                    />
                  )
                })}
              </ul>
            </div>
          ) : null}

          <button type="button" className="primary" onClick={leaveRoom}>
            Leave Room
          </button>
        </section>
      ) : (
      <section className="room-card">

        <div className="room-game-header">
          <p className="room-card-code">
            Room Code: <strong>{activeRoom.code}</strong>
          </p>

          <button
            type="button"
            className="ghost rooms-danger rooms-end-meeting"
            onClick={() => setLeaveConfirmOpen(true)}
          >
            {leaveLabel}
          </button>
        </div>

        <h1>Exchange</h1>

        {roomNotice ? <p className="room-notice">{roomNotice}</p> : null}

        {!exchange ? (
          <div className="icebreaker-waiting">
            {sittingOut ? (
              <>
                <strong>Sitting this round out</strong>
                <p>
                  Odd number of players — you&apos;ll jump back in next round when Gemini rematches everyone.
                </p>
              </>
            ) : waitingForRematch ? (
              <>
                <strong>Waiting for other pairs…</strong>
                <p>
                  Other players are still finishing. Everyone will be rematched together afterward.
                </p>
              </>
            ) : (
              <>
                <strong>Waiting for a partner...</strong>
                <p>
                  You&apos;re still in the meeting. We&apos;ll pair you when someone becomes available.
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            <p className="room-section-title">Your Partner</p>

            <div className="room-member">
              <div className="room-member-info">
                <div className="room-avatar">
                  {exchange.partner?.profile_photo ? (
                    <img src={exchange.partner.profile_photo} alt="" />
                  ) : (
                    <span>
                      {(exchange.partner?.display_name || 'U')
                        .slice(0, 1)
                        .toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <strong>{exchange.partner?.display_name || 'Player'}</strong>
                  {exchange.partner?.tag ? <p>#{exchange.partner.tag}</p> : null}
                </div>
              </div>
            </div>

            <div className="rooms-match-pair">
              <MiniCard
                card={exchange.my_card}
                label="Your card"
                onPreview={openCardPreview}
              />
              <MiniCard
                card={exchange.their_card}
                label={`${exchange.partner?.display_name || 'Partner'}'s card`}
                onPreview={openCardPreview}
              />
            </div>

            {exchange.connection_note ? (
              <p className="rooms-connection-note">{exchange.connection_note}</p>
            ) : null}

            {(exchange.status === 'icebreaker' || exchange.status === 'trade') ? (
              <>
                <div className="room-divider-line" />
                <p className="room-section-title">Icebreaker</p>
                <h2 className="rooms-icebreaker-q">{exchange.icebreaker_question}</h2>

                {exchange.status === 'icebreaker' && !exchange.answer_submitted ? (
                  <div className="icebreaker-answer">
                    <textarea
                      value={icebreakerAnswer}
                      onChange={(event) => {
                        const value = event.target.value
                        setIcebreakerAnswer(value)
                        sessionStorage.setItem('icebreakerDraft', value)
                      }}
                      placeholder="Type your answer..."
                      maxLength={500}
                      rows={4}
                    />
                    <button
                      type="button"
                      className="primary"
                      onClick={submitAnswer}
                      disabled={gameBusy || !icebreakerAnswer.trim()}
                    >
                      Submit Answer
                    </button>
                  </div>
                ) : null}

                {exchange.status === 'icebreaker' && exchange.answer_submitted ? (
                  <div className="icebreaker-waiting">
                    <strong>Answer submitted!</strong>
                    <p>Waiting for your partner to answer...</p>
                  </div>
                ) : null}

                {exchange.status === 'trade' && exchange.both_answered ? (
                  <div className="rooms-answers">
                    <div className="rooms-answer-block">
                      <p className="room-section-title">Your answer</p>
                      <p>{exchange.my_answer}</p>
                    </div>
                    <div className="rooms-answer-block">
                      <p className="room-section-title">
                        {exchange.partner?.display_name || 'Partner'}&apos;s answer
                      </p>
                      <p>{exchange.their_answer}</p>
                    </div>
                  </div>
                ) : null}

                {exchange.status === 'trade' ? (
                  <div className="rooms-trade-vote">
                    <p className="rooms-lede">
                      Want to trade these two matched cards?
                    </p>
                    {exchange.my_trade_vote == null ? (
                      <div className="rooms-trade-actions">
                        <button
                          type="button"
                          className="primary"
                          disabled={gameBusy}
                          onClick={() => voteTrade(true)}
                        >
                          Trade
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          disabled={gameBusy}
                          onClick={() => voteTrade(false)}
                        >
                          Pass
                        </button>
                      </div>
                    ) : (
                      <div className="icebreaker-waiting">
                        <strong>
                          {exchange.my_trade_vote ? 'You voted to trade.' : 'You passed.'}
                        </strong>
                        <p>
                          {exchange.both_voted_trade
                            ? 'Resolving…'
                            : 'Waiting for your partner to vote…'}
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}
              </>
            ) : null}

            {exchange.status === 'between_rounds' ? (
              <div className="rooms-between">
                <div className="icebreaker-waiting">
                  <strong>
                    {exchange.trade_completed
                      ? 'Trade complete!'
                      : 'No trade this round.'}
                  </strong>
                  <p>
                    {exchange.trade_completed
                      ? 'Cards swapped. Traded cards can’t be added back into this game.'
                      : 'Ready for another round when you both are.'}
                  </p>
                </div>

                {exchange.can_add_card ? (
                  <div className="rooms-add-card">
                    <p className="room-section-title">Add another card (optional)</p>
                    <ul className="trade-card-grid rooms-deck-grid">
                      {(exchange.addable_cards || []).map((card) => {
                        const imageSrc = cardImageSrc(card.image)
                        return (
                          <li
                            key={card.id}
                            className="trade-card"
                            data-rarity={card.rarity}
                          >
                            <button
                              type="button"
                              className="blank-card-button"
                              disabled={gameBusy}
                              onClick={() => handleAddCard(card.id)}
                            >
                              {imageSrc ? (
                                <img src={imageSrc} alt="" className="card-full-image" />
                              ) : null}
                              <div className="card-rarity-stars" aria-label={card.rarity}>
                                {Array.from(
                                  { length: rarityStarCount(card.rarity) },
                                  (_, index) => (
                                    <span key={index}>★</span>
                                  ),
                                )}
                              </div>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ) : null}

                <p className="rooms-lede">
                  Deck in play: {exchange.my_deck_count} card
                  {exchange.my_deck_count === 1 ? '' : 's'}
                </p>

                <div className="rooms-between-actions">
                  <button
                    type="button"
                    className="primary"
                    disabled={gameBusy || exchange.i_am_ready || exchange.my_deck_count < 1}
                    onClick={handleReadyNext}
                  >
                    {exchange.i_am_ready
                      ? (exchange.they_are_ready
                        ? 'Waiting for other pairs…'
                        : 'Waiting for partner…')
                      : 'Ready for next round'}
                  </button>
                  <button
                    type="button"
                    className="ghost rooms-danger"
                    disabled={gameBusy}
                    onClick={handleEndGame}
                  >
                    End Game
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}

      </section>
      )}

      {leaveConfirmOpen && !showGameOver ? (
        <div
          className="rooms-confirm-overlay"
          role="presentation"
          onClick={() => setLeaveConfirmOpen(false)}
        >
          <div
            className="rooms-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rooms-leave-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="rooms-leave-title">{confirmTitle}</h2>
            <p>{confirmBody}</p>
            <div className="rooms-confirm-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => setLeaveConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary rooms-confirm-danger"
                onClick={() => {
                  setLeaveConfirmOpen(false)
                  leaveRoom()
                }}
              >
                {leaveLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <CardPreviewModal
        card={previewCard}
        flipped={previewFlipped}
        onToggleFlip={() => setPreviewFlipped((value) => !value)}
        onClose={closeCardPreview}
      />
    </main>
  )
}

  if (activeRoom) {
    const hostId = activeRoom.host?.id
    const hostExpanded = hostId != null && visibleDecks.has(hostId)

    return (
      <main className="rooms-page">
        <section className="room-card">

          <div className="room-card-header">
            <p className="room-card-code">
              Room Code: <strong>{activeRoom.code}</strong>
            </p>
          </div>

          <div className="room-section">
            <p className="room-section-title">Host</p>

            <div className="room-member">
              <div className="room-member-info">

                <div className="room-avatar">
                  {activeRoom.host?.profile_photo ? (
                    <img
                      src={activeRoom.host.profile_photo}
                      alt=""
                    />
                  ) : (
                    <span>
                      {(activeRoom.host?.display_name || 'U')
                        .slice(0, 1)
                        .toUpperCase()}
                    </span>
                  )}
                </div>

                <div>
                  <strong>
                    {activeRoom.host?.display_name || 'Player'}
                  </strong>

                  {activeRoom.host?.tag ? (
                    <p>#{activeRoom.host.tag}</p>
                  ) : null}
                </div>

              </div>

              <button
                type="button"
                className="ghost rooms-show-cards"
                onClick={() => toggleDeckVisibility(hostId)}
              >
                {hostExpanded ? 'Hide Cards' : 'Show Cards'}
              </button>
            </div>

            {hostExpanded ? <DeckPreview cards={activeRoom.hostCards} /> : null}
          </div>

          <div className="room-divider-line" />

          <div className="room-section">
            <p className="room-section-title">Members</p>

            {activeRoom.members.length ? (
              activeRoom.members.map((member) => {
                const expanded = visibleDecks.has(member.id)
                return (
                  <div className="room-member-block" key={member.id}>
                    <div className="room-member">
                      <div className="room-member-info">
                        <div className="room-avatar">
                          {member.profile_photo ? (
                            <img
                              src={member.profile_photo}
                              alt=""
                            />
                          ) : (
                            <span>
                              {(member.display_name || 'U')
                                .slice(0, 1)
                                .toUpperCase()}
                            </span>
                          )}
                        </div>

                        <strong>
                          {member.display_name}
                        </strong>
                      </div>

                      <button
                        type="button"
                        className="ghost rooms-show-cards"
                        onClick={() => toggleDeckVisibility(member.id)}
                      >
                        {expanded ? 'Hide Cards' : 'Show Cards'}
                      </button>
                    </div>

                    {expanded ? <DeckPreview cards={member.cards} /> : null}
                  </div>
                )
              })
            ) : (
              <p className="room-empty">
                Waiting for people to join...
              </p>
            )}
          </div>

          <div className="room-bottom-actions">

            {activeRoom.isHost ? (
              <button
                type="button"
                className="primary"
                onClick={startMeeting}
                disabled={gameBusy}
              >
                {gameBusy ? 'Matching cards…' : 'Start Meeting'}
              </button>
            ) : null}

            <button
              type="button"
              className="ghost rooms-danger"
              onClick={leaveRoom}
            >
              {activeRoom.isHost
                ? 'Cancel Room'
                : 'Leave Room'}
            </button>

          </div>

        </section>
      </main>
    )
  }

  if (entryStep === 'pick-cards' && !activeRoom) {
    return (
      <main className="rooms-page rooms-page--picker">
        <section className="rooms-start rooms-deck-picker">
          <h1>Bring your cards</h1>
          <p className="rooms-lede">
            Select 1 to {MAX_DECK_CARDS} cards from your collection to take into the room.
          </p>

          {roomNotice ? <p className="room-notice">{roomNotice}</p> : null}

          <p className="rooms-deck-count">
            {selectedDeckIds.length} / {MAX_DECK_CARDS} selected
          </p>

          {cardsLoading ? (
            <p className="rooms-lede">Loading your cards…</p>
          ) : (
            <ul className="trade-card-grid rooms-deck-grid">
              {ownedCards.map((card) => {
                const selected = selectedDeckIds.includes(card.id)
                const imageSrc = cardImageSrc(card.image)
                return (
                  <li
                    key={card.id}
                    className={`trade-card ${selected ? 'is-selected' : ''}`}
                    data-rarity={card.rarity}
                  >
                    <button
                      type="button"
                      className="blank-card-button"
                      onClick={() => toggleDeckCard(card.id)}
                      disabled={deckBusy}
                      aria-pressed={selected}
                    >
                      {imageSrc ? (
                        <img src={imageSrc} alt="" className="card-full-image" />
                      ) : null}
                      <div className="card-rarity-stars" aria-label={card.rarity}>
                        {Array.from({ length: rarityStarCount(card.rarity) }, (_, index) => (
                          <span key={index}>★</span>
                        ))}
                      </div>
                      {selected ? (
                        <span className="rooms-card-check" aria-hidden="true">
                          <span className="rooms-card-check-badge">
                            <svg
                              className="rooms-card-check-icon"
                              viewBox="0 0 24 24"
                              fill="none"
                              aria-hidden="true"
                            >
                              <path
                                d="M6.5 12.5L10.2 16.2L17.5 8.5"
                                stroke="currentColor"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="rooms-deck-actions">
            <button
              type="button"
              className="primary"
              onClick={confirmDeckPick}
              disabled={deckBusy || selectedDeckIds.length < 1}
            >
              {pendingAction === 'create' ? 'Create Room' : 'Join Room'}
            </button>
            <button
              type="button"
              className="rooms-text-cancel"
              onClick={cancelDeckPick}
              disabled={deckBusy}
            >
              Cancel
            </button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="rooms-page">

      <div className="rooms-start">
        <h1>Rooms</h1>

        <p className="rooms-lede">
          Create a room or join your friends with a 4-digit room code.
        </p>

        {collectionCount === 0 ? (
          <div className="rooms-locked">
            <p>
              You need at least one card in your collection before you can create or join a room.
            </p>
            <Link className="primary rooms-locked-cta" to="/">
              Add a card
            </Link>
          </div>
        ) : null}

        {roomNotice ? (
          <p className="room-notice">
            {roomNotice}
          </p>
        ) : null}

        <div className="room-actions">

          <button
            type="button"
            className="primary"
            onClick={beginCreateRoom}
            disabled={!canUseRooms}
          >
            Create Room
          </button>

          <div className="room-or">
            <span>OR</span>
          </div>

          <form className="room-join" onSubmit={beginJoinRoom}>

            <label htmlFor="room-code">
              Room Code
            </label>

            <input
              id="room-code"
              type="text"
              inputMode="numeric"
              pattern="\d{4}"
              autoComplete="one-time-code"
              value={joinCode}
              placeholder="1234"
              maxLength={4}
              disabled={!canUseRooms}
              onChange={(event) =>
                setJoinCode(
                  event.target.value.replace(/\D/g, '').slice(0, 4)
                )
              }
            />

            <button
              type="submit"
              className="primary"
              disabled={!canUseRooms || joinCode.length !== 4}
            >
              Join Room
            </button>

          </form>

        </div>
      </div>

    </main>
  )
}