# Color Finder

A semantic font search engine powered by vector embeddings. Search for fonts (typefaces) using natural language descriptions and get matching font suggestions.

## Features

- Natural language font search using Mistral embeddings
- 1,200+ named colors in the database
- Fast vector similarity search using PostgreSQL/Supabase
- Returns font names, details, and similarity scores

## Technical Decisions (All Lightly Taken)

- Uses Mistral's mistral-embed model for semantic embeddings
- PostgreSQL vector extension with IVFFlat indexing
- Supabase for database hosting and RPC functions
- TypeScript/Node.js backend

## Getting Started

1. Clone the repo
2. Clone the .env.example to .env and swap in your OpenAI / Supabase credentials
3. Install dependencies: `npm install`
4. Run the development server: `npm run dev`

## Credits

Written by [lui](https://github.com/yablochko8) for [brandmint.ai](https://brandmint.ai)
