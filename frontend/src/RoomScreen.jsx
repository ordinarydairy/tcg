import { useEffect, useState } from 'react'
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
  selectExchangeCards,
} from './api'
import './Rooms.css'

export default function RoomScreen() {
  const { user } = useAuth()

  const [roomCode, setRoomCode] = useState('')
  const [activeRoom, setActiveRoom] = useState(null)
  const [joinCode, setJoinCode] = useState('')
  const [roomNotice, setRoomNotice] = useState('')
  const [exchange, setExchange] = useState(null)
  const [icebreakerAnswer, setIcebreakerAnswer] = useState(() => {
    return sessionStorage.getItem('icebreakerDraft') || ''
  })
  const [answerSubmitted, setAnswerSubmitted] = useState(false)
  const [myCards, setMyCards] = useState([])
  const [partnerCards, setPartnerCards] = useState([])
  const [mySelectedCard, setMySelectedCard] = useState(null)
  const [partnerSelectedCard, setPartnerSelectedCard] = useState(null)
  const [cardsSubmitted, setCardsSubmitted] = useState(false)

  useEffect(() => {
    async function restoreRoom() {
      try {
        const data = await fetchCurrentRoom()

        if (!data.room) {
          return
        }

        const room = data.room

        setActiveRoom({
          code: room.code,
          isHost: room.is_host,
          host: room.host,
          members: room.members,
          meetingStarted: room.meeting_started,
        })

        setRoomCode(room.code)
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

      setActiveRoom({
        code: room.code,
        isHost: room.is_host,
        host: room.host,
        members: room.members,
        meetingStarted: room.meeting_started,
      })
    } catch (error) {
      console.error('Could not refresh room:', error)

      setActiveRoom(null)
      setRoomCode('')
      setJoinCode('')
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

      if (!data.exchange) {
        setExchange(null)
        return
      }

      setExchange((current) => {
        // Don't replace the exchange object every 2 seconds
        // if we're still in the same exchange.
        if (current?.id === data.exchange.id) {
          return current
        }

        return data.exchange
      })

      // A NEW exchange was loaded.
      if (data.exchange.answer_submitted) {
        setIcebreakerAnswer(data.exchange.my_answer || '')
        setAnswerSubmitted(true)
      } else {
        setAnswerSubmitted(false)
      }

      setCardsSubmitted(data.exchange.cards_submitted)
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




useEffect(() => {
  if (!exchange?.partner?.id || !user?.id) {
    return
  }

  async function loadCards() {
    try {
      const [mine, theirs] = await Promise.all([
        fetchCards(user.id),
        fetchCards(exchange.partner.id),
      ])

      console.log('MY CARDS RESPONSE:', mine)
      console.log('PARTNER CARDS RESPONSE:', theirs)

      setMyCards(mine.cards || mine)
      setPartnerCards(theirs.cards || theirs)
    } catch (error) {
      console.error('Could not load cards:', error)
    }
  }

  loadCards()
}, [exchange?.partner?.id, user?.id])

  async function createRoom() {
    setRoomNotice('')
    try {
      const room = await createRoomApi()

      setRoomCode(room.code)

      setActiveRoom({
        code: room.code,
        isHost: room.is_host,
        host: room.host,
        members: room.members,
        meetingStarted: room.meeting_started,
      })
    } catch (error) {
      console.error('Create room failed:', error)
    }
  }

  async function joinRoom() {
    setRoomNotice('')
    const code = joinCode.trim().toUpperCase()

    if (!code) {
      return
    }

    try {
      const room = await joinRoomApi(code)

      setRoomCode(room.code)

      setActiveRoom({
        code: room.code,
        isHost: room.is_host,
        host: room.host,
        members: room.members,
        meetingStarted: room.meeting_started,
      })
    } catch (error) {
      console.error('Join room failed:', error)
    }
  }

  async function startMeeting() {
    if (!activeRoom) return

    try {
      await startMeetingApi(activeRoom.code)

      setActiveRoom((current) => ({
        ...current,
        meetingStarted: true,
      }))
    } catch (error) {
      console.error('Could not start meeting:', error)
    }
  }

  async function submitAnswer() {
    const answer = icebreakerAnswer.trim()

    if (!answer || !activeRoom) {
      return
    }

    try {
      await submitIcebreaker(activeRoom.code, answer)
      setAnswerSubmitted(true)
      sessionStorage.removeItem('icebreakerDraft')
    } catch (error) {
      console.error('Could not submit answer:', error)
    }
  }

  async function submitCards() {
    if (!activeRoom || !mySelectedCard || !partnerSelectedCard) {
      return
    }

    try {
      await selectExchangeCards(
        activeRoom.code,
        mySelectedCard.id,
        partnerSelectedCard.id,
      )

      setCardsSubmitted(true)
    } catch (error) {
      console.error('Could not submit cards:', error)
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

      setExchange(null)

      setIcebreakerAnswer('')
      sessionStorage.removeItem('icebreakerDraft')
      setAnswerSubmitted(false)

      setMyCards([])
      setPartnerCards([])

      setMySelectedCard(null)
      setPartnerSelectedCard(null)

      setCardsSubmitted(false)

      if (wasHost) {
        setRoomNotice('Room canceled.')
      }
    } catch (error) {
      console.error('Could not leave room:', error)
    }
  }

  if (activeRoom?.meetingStarted) {
  return (
    <main className="rooms-page">
      <section className="room-card">

        <p className="room-card-code">
          Room Code: <strong>{activeRoom.code}</strong>
        </p>

        <button
          type="button"
          className="leave-room-button"
          onClick={leaveRoom}
        >
          {activeRoom.isHost ? 'End Meeting' : 'Leave Meeting'}
        </button>



        <h1>Exchange</h1>

        {!exchange ? (
          <div className="icebreaker-waiting">
            <strong>Waiting for a partner...</strong>
            <p>
              You're still in the meeting. We'll pair you when someone becomes available.
            </p>
          </div>
        ) : (
          <>
            <p className="room-section-title">
              Your Partner
            </p>

            <div className="room-member">
              <div className="room-member-info">

                <div className="room-avatar">
                  {exchange.partner?.profile_photo ? (
                    <img
                      src={exchange.partner.profile_photo}
                      alt=""
                    />
                  ) : (
                    <span>
                      {(exchange.partner?.display_name || 'U')
                        .slice(0, 1)
                        .toUpperCase()}
                    </span>
                  )}
                </div>

                <div>
                  <strong>
                    {exchange.partner?.display_name || 'Player'}
                  </strong>

                  {exchange.partner?.tag ? (
                    <p>#{exchange.partner.tag}</p>
                  ) : null}
                </div>

              </div>
            </div>

            <div className="exchange-collections">

              {!cardsSubmitted ? (
                  <button
                    type="button"
                    className="start-meeting-button"
                    onClick={submitCards}
                    disabled={!mySelectedCard || !partnerSelectedCard}
                  >
                    Lock In Cards
                  </button>
                ) : (
                  <p className="icebreaker-waiting">
                    Cards locked in!
                  </p>
                )}

  <div className="exchange-collection">
    <p className="room-section-title">Your Cards</p>

    <div className="exchange-card-grid">
      {myCards.map((card) => (
        <button
          type="button"
          key={card.id}
          className={
            mySelectedCard?.id === card.id
              ? 'exchange-card selected'
              : 'exchange-card'
          }
          onClick={() => setMySelectedCard(card)}
        >
          {card.image ? (
            <img src={card.image} alt="" />
          ) : (
            <span>No image</span>
          )}
        </button>
      ))}
    </div>
  </div>

      <div className="exchange-collection">
          <p className="room-section-title">
            {exchange.partner?.display_name}'s Cards
          </p>

          <div className="exchange-card-grid">
            {partnerCards.map((card) => (
              <button
                type="button"
                key={card.id}
                className={
                  partnerSelectedCard?.id === card.id
                    ? 'exchange-card selected'
                    : 'exchange-card'
                }
                onClick={() => setPartnerSelectedCard(card)}
              >
                {card.image ? (
                  <img src={card.image} alt="" />
                ) : (
                  <span>No image</span>
                )}
              </button>
            ))}
          </div>
        </div>

      </div>


            <div className="room-divider-line" />

            <p className="room-section-title">
              Icebreaker
            </p>

            <h2>
              {exchange.icebreaker_question}
            </h2>
                      {!answerSubmitted ? (
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
                className="start-meeting-button"
                onClick={submitAnswer}
                disabled={!icebreakerAnswer.trim()}
              >
                Submit Answer
              </button>
            </div>
          ) : (
            <div className="icebreaker-waiting">
              <strong>Answer submitted!</strong>
              <p>Waiting for your partner to answer...</p>
            </div>
          )}
          </>
        )}

      </section>
    </main>
  )
}

  if (activeRoom) {
    return (
      <main className="rooms-page">
        <section className="room-card exchange-room-card">

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
            </div>
          </div>

          <div className="room-divider-line" />

          <div className="room-section">
            <p className="room-section-title">Members</p>

            {activeRoom.members.length ? (
              activeRoom.members.map((member) => (
                <div
                  className="room-member"
                  key={member.id}
                >
                  <div className="room-member-info">
                    <div className="room-avatar">
                      {member.profile_photo ? (
                        <img
                          src={member.profile_photo}
                          alt=""
                        />
                      ) : (
                        <span>
                          {member.display_name
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
                    className="view-cards-button"
                  >
                    View Cards
                  </button>
                </div>
              ))
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
                className="start-meeting-button"
                onClick={startMeeting}
              >
                Start Meeting
              </button>
            ) : null}

            <button
              type="button"
              className="leave-room-button"
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

  return (
    <main className="rooms-page">

      <div className="rooms-start">
        <h1>Rooms</h1>

        <p className="rooms-lede">
          Create a room or join your friends with a room code.
        </p>

        {roomNotice ? (
          <p className="room-notice">
            {roomNotice}
          </p>
        ) : null}

        <div className="room-actions">

          <button
            type="button"
            className="room-create-button"
            onClick={createRoom}
          >
            Create Room
          </button>

          <div className="room-or">
            <span>OR</span>
          </div>

          <div className="room-join">

            <label htmlFor="room-code">
              Room Code
            </label>

            <input
              id="room-code"
              type="text"
              value={joinCode}
              placeholder="Enter room code"
              maxLength={6}
              onChange={(event) =>
                setJoinCode(
                  event.target.value.toUpperCase()
                )
              }
            />

            <button
              type="button"
              className="room-join-button"
              onClick={joinRoom}
            >
              Join Room
            </button>

          </div>

        </div>
      </div>

    </main>
  )
}