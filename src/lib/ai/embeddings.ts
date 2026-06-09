import OpenAI from 'openai'

let _client: OpenAI | null = null

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      organization: process.env.OPENAI_ORGANIZATION_ID,
    })
  }
  return _client
}

// Returns a 1536-dimensional embedding vector for the given text.
// Uses text-embedding-3-small — cheapest model, excellent quality for property data.
export async function embedText(text: string): Promise<number[]> {
  const client = getClient()

  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000), // guard against token limit
  })

  return response.data[0].embedding
}

// Embed multiple texts in one API call (up to 2048 inputs)
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  const client = getClient()

  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts.map((t) => t.slice(0, 8000)),
  })

  return response.data.map((d) => d.embedding)
}
