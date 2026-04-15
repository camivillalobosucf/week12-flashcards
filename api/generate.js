import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env.local') })

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { notes } = req.body

  if (!notes || !notes.trim()) {
    return res.status(400).json({ error: 'Notes are required' })
  }

  // SSE headers — keep connection open for streaming
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  try {
    const stream = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      stream: true,
      messages: [
        {
          role: 'user',
          content: `You are a study assistant. Based on the following notes, generate exactly 5 flashcards.

Rules:
- Each question must be 10 words or fewer
- Each answer must be 15 words or fewer
- Be concise and direct — no filler words

Return ONLY a valid JSON object in this exact format, with no extra text, markdown, or explanation:
{
  "flashcards": [
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." }
  ]
}

Notes:
${notes}`,
        },
      ],
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        // JSON-encode each chunk so newlines inside text don't break SSE framing
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
    res.end()
  } catch (err) {
    console.error('API error:', err)
    res.write(`data: ${JSON.stringify({ error: err.message || 'Internal server error' })}\n\n`)
    res.end()
  }
}
