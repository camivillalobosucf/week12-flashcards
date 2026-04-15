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

// Matches complete { "question": "...", "answer": "..." } objects in streamed text.
// Handles escaped characters inside the string values.
const CARD_REGEX = /\{\s*"question"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"answer"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g

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

      // Non-2xx before streaming starts means a hard error (e.g. 400/405)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Server error: ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''       // incomplete SSE event bytes
      let accumulated = ''  // full streamed text so far
      let cardCount = 0     // how many cards we've already added

      outer: while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // SSE events are separated by double newlines
        const events = buffer.split('\n\n')
        buffer = events.pop() // last item may be incomplete — keep in buffer

        for (const event of events) {
          const line = event.trim()
          if (!line.startsWith('data: ')) continue

          let payload
          try {
            payload = JSON.parse(line.slice(6))
          } catch {
            continue // malformed chunk — skip
          }

          if (payload.error) throw new Error(payload.error)
          if (payload.done) break outer

          accumulated += payload.text

          // Detect any newly completed flashcard objects in the accumulated JSON
          const matches = [...accumulated.matchAll(CARD_REGEX)]
          if (matches.length > cardCount) {
            const newCards = matches.slice(cardCount).map(m => ({
              question: m[1].replace(/\\"/g, '"').replace(/\\n/g, ' '),
              answer:   m[2].replace(/\\"/g, '"').replace(/\\n/g, ' '),
            }))
            setFlashcards(prev => [...prev, ...newCards])
            cardCount = matches.length
          }
        }
      }
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

      {loading && flashcards.length === 0 && (
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
