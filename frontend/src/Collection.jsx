import { useEffect, useState } from 'react'
import './Collection.css'

function Collection() {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/cards/')
      .then((response) => response.json())
      .then((data) => {
        setCards(data)
        setLoading(false)
      })
      .catch((error) => {
        console.error('Error loading cards:', error)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <p>Loading cards...</p>
  }

  return (
    <div className="collection-page">
      <h1>My Collection</h1>

      <div className="card-grid">
        {cards.map((card) => (
          <div className="photo-card" key={card.id}>
            <img
              src={`http://127.0.0.1:8000${card.image}`}
              alt="Memory"
            />

            <h2>{card.rarity}</h2>
            <h3>{card.overall_score}/100</h3>
            <p>{card.story}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Collection