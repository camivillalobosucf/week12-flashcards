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
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const { notes } = req.body

    if (!notes || !notes.trim()) {
      return res.status(400).json({ error: 'Notes are required' })
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
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

    const raw = message.content[0].text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(raw)

    return res.status(200).json(parsed)
  } catch (err) {
    console.error('API error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
