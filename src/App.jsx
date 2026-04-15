import { useState } from 'react'
import './App.css'

function Flashcard({ question, answer }) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div className="flashcard" onClick={() => setFlipped(!flipped)}>
      <div className={`flashcard-inner ${flipped ? 'flipped' : ''}`}>
        <div className="flashcard-front">
          <span className="card-label">Question</span>
          <p>{question}</p>
        </div>
        <div className="flashcard-back">
          <span className="card-label">Answer</span>
          <p>{answer}</p>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [notes, setNotes] = useState('')
  const [flashcards, setFlashcards] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGenerate() {
    if (!notes.trim()) return
    setLoading(true)
    setError('')
    setFlashcards([])

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`)
      }

      const data = await res.json()
      setFlashcards(data.flashcards)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h1>Flashcard Generator</h1>
      <p className="subtitle">Paste your study notes and get 5 flashcards instantly.</p>

      <textarea
        className="notes-input"
        placeholder="Paste your study notes here..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={8}
      />

      <button
        className="generate-btn"
        onClick={handleGenerate}
        disabled={loading || !notes.trim()}
      >
        {loading ? 'Generating...' : 'Generate Flashcards'}
      </button>

      {error && <p className="error">{error}</p>}

      {loading && (
        <div className="loading">
          <div className="spinner" />
          <p>Calling the AI, hang tight...</p>
        </div>
      )}

      {flashcards.length > 0 && (
        <div className="cards-section">
          <p className="hint">Click a card to reveal the answer.</p>
          <div className="cards-grid">
            {flashcards.map((card, i) => (
              <Flashcard key={i} question={card.question} answer={card.answer} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
