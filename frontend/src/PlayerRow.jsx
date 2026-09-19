/* eslint-disable react-refresh/only-export-components */
import { Link } from 'react-router-dom'

export default function PlayerRow({ player, actionLabel, actionBusy, onAction }) {
  return (
    <li className="player-row">
      <Link className="player-identity" to={`/users/${player.id}`}>
        {player.profile_photo ? (
          <img src={player.profile_photo} alt="" className="player-avatar" />
        ) : (
          <span className="player-avatar fallback" aria-hidden="true">
            {player.display_name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="player-name">{player.display_name}</span>
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
