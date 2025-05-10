import type { Route } from "./+types/_index"
import { useEffect, useMemo, useState } from "react"

import {
  ControlBar,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
  RoomContext,
  useVoiceAssistant,
  useConnectionState,
} from "@livekit/components-react"
import { ConnectionState, Room, Track } from "livekit-client"
import "@livekit/components-styles"

export function meta({}: Route.MetaArgs) {
  return [
    { title: "LiveKit - Vision" },
    { name: "description", content: "LiveKit Vision Agent" },
  ]
}

export async function loader() {
  return { livekitUrl: process.env.LIVEKIT_URL }
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const [roomInstance] = useState(() => {
    return new Room({
      adaptiveStream: true,
      dynacast: true,
    })
  })

  useEffect(() => {
    let mounted = true

    async function connect() {
      try {
        const resp = await fetch(`/api/token`)
        const data = await resp.json()
        if (!mounted || !data.token) return

        await roomInstance.connect(loaderData.livekitUrl, data.token)
      } catch (e) {
        console.error(e)
      }
    }

    connect()

    return () => {
      mounted = false
      roomInstance.disconnect()
    }
  }, [roomInstance])

  return (
    <RoomContext.Provider value={roomInstance}>
      <div data-lk-theme="default" style={{ height: "100dvh" }}>
        <VideoConference />
        <RoomAudioRenderer />
        <ControlBar />
        <AgentStatus />
      </div>
    </RoomContext.Provider>
  )
}

function AgentStatus() {
  const roomState = useConnectionState()
  const voiceAssistant = useVoiceAssistant()

  return (
    <div className="fixed flex items-center gap-1 bottom-3 right-3 py-[0.625rem] px-4 bg-black text-white rounded-lg">
      <p>Agent Connected: </p>
      <p>
        {roomState === ConnectionState.Connecting
          ? "LOADING"
          : voiceAssistant.agent
          ? "TRUE"
          : "FALSE"}
      </p>
    </div>
  )
}

function VideoConference() {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false }
  )

  const filteredTracks = tracks.filter((track) => {
    const isAgent = track.participant.isAgent
    return !isAgent
  })

  return (
    <GridLayout
      tracks={filteredTracks}
      style={{ height: "calc(100vh - var(--lk-control-bar-height))" }}
    >
      {/* The GridLayout accepts zero or one child. The child is used
      as a template to render all passed in tracks. */}
      <ParticipantTile />
    </GridLayout>
  )
}
