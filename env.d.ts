declare namespace NodeJS {
  interface ProcessEnv {
    LIVEKIT_URL: string
    LIVEKIT_API_KEY: string
    LIVEKIT_API_SECRET: string

    DEEPGRAM_API_KEY: string
    CARTESIA_API_KEY: string

    OPENAI_API_KEY: string
    GOOGLE_API_KEY: string
  }
}
