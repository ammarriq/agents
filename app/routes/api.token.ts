import { AccessToken } from "livekit-server-sdk"

export async function loader() {
  const username = `user_${crypto.randomUUID()}`
  const room = `room_${crypto.randomUUID()}`

  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const wsUrl = process.env.LIVEKIT_URL

  if (!apiKey || !apiSecret || !wsUrl) {
    return Response.json(
      { error: "Server misconfigured" }, //
      { status: 500 }
    )
  }

  const at = new AccessToken(apiKey, apiSecret, { identity: username })
  at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true })

  return Response.json(
    { token: await at.toJwt() },
    { headers: { "Cache-Control": "no-store" } }
  )
}
