/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react'
import { Link } from 'react-router-dom'

function PlayerAvatar({ player }) {
  const [failed, setFailed] = useState(false)
  if (!player.profile_photo || failed) {
    return (
      <span className="player-avatar fallback" aria-hidden="true">
        {player.display_name.slice(0, 1).toUpperCase()}
      </span>
    )
  }
  return (
    <img
      src={player.profile_photo}
      alt=""
      className="player-avatar"
      onError={() => setFailed(true)}
    />
  )
}

export default function PlayerRow({ player, actionLabel, actionBusy, onAction }) {
  return (
    <li className="player-row">
      <Link className="player-identity" to={`/users/${player.id}`}>
        <PlayerAvatar player={player} />
        <span className="player-copy">
          <span className="player-name">{player.display_name}</span>
          {player.tag ? <span className="player-tag">#{player.tag}</span> : null}
        </span>
      </Link>
      {actionLabel ? (
        <button
          type="button"
          className="ghost player-action"
          disabled={actionBusy || actionLabel === 'Requested'}
          onClick={() => onAction?.(player)}
        >
          {actionBusy ? '…' : actionLabel}
        </button>
      ) : null}
    </li>
  )
}

export function friendshipActionLabel(status) {
  if (status === 'friends') return 'Friends'
  if (status === 'pending_sent') return 'Requested'
  if (status === 'pending_received') return 'Accept'
  return 'Add friend'
}
