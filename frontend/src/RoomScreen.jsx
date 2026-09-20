import { useState } from 'react'
import { useAuth } from './AuthContext'
import './Rooms.css'

export default function RoomScreen() {
  const { user } = useAuth()

  const [roomCode, setRoomCode] = useState('')
  const [activeRoom, setActiveRoom] = useState(null)
  const [joinCode, setJoinCode] = useState('')

  function createRoom() {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''

    for (let i = 0; i < 6; i += 1) {
      code += characters[Math.floor(Math.random() * characters.length)]
    }

    setRoomCode(code)

    setActiveRoom({
      code,
      isHost: true,
      members: [],
    })
  }

  function leaveRoom() {
    setActiveRoom(null)
    setRoomCode('')
    setJoinCode('')
  }

  if (activeRoom) {
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
                  {user?.profile_photo ? (
                    <img
                      src={user.profile_photo}
                      alt=""
                    />
                  ) : (
                    <span>
                      {(user?.display_name || 'U')
                        .slice(0, 1)
                        .toUpperCase()}
                    </span>
                  )}
                </div>

                <div>
                  <strong>
                    {user?.display_name || 'Player'}
                  </strong>

                  {user?.tag ? (
                    <p>#{user.tag}</p>
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

          <button
            type="button"
            className="leave-room-button"
            onClick={leaveRoom}
          >
            {activeRoom.isHost
              ? 'Cancel Room'
              : 'Leave Room'}
          </button>

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
            >
              Join Room
            </button>

          </div>

        </div>
      </div>

    </main>
  )
}