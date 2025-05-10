import os
import logging

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli
from livekit.agents.llm import ImageContent, ChatContext, ChatMessage
from livekit.agents.voice import AgentSession, Agent, room_io
from livekit.plugins import (
    cartesia,
    openai,
    deepgram,
    noise_cancellation,
    silero,
)


script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
dotenv_path = os.path.join(project_root, ".env")

load_dotenv(dotenv_path=dotenv_path)
logger = logging.getLogger("voice-agent")


async def get_video_track(room: rtc.Room):
    """Find and return the first available remote video track in the room."""
    for participant_id, participant in room.remote_participants.items():
        for _, track_publication in participant.track_publications.items():
            if track_publication.track and isinstance(
                track_publication.track, rtc.RemoteVideoTrack
            ):
                logger.info(
                    f"Found video track {track_publication.track.sid} "
                    f"from participant {participant_id}"
                )
                return track_publication.track
    raise ValueError("No remote video track found in the room")


async def get_latest_image(room: rtc.Room):
    """Capture and return a single frame from the video track."""
    video_stream = None
    try:
        video_track = await get_video_track(room)
        video_stream = rtc.VideoStream(video_track)
        async for event in video_stream:
            logger.debug("Captured latest video frame")
            return event.frame
    except Exception as e:
        logger.error(f"Failed to get latest image: {e}")
        return None
    finally:
        if video_stream:
            await video_stream.aclose()


class Assistant(Agent):
    def __init__(self, room: rtc.Room) -> None:
        super().__init__(
            instructions=(
                "You are a voice assistant created by LiveKit that can both see and hear. "
                "You should use short and concise responses, avoiding unpronounceable punctuation. "
                "When you see an image in our conversation, naturally incorporate what you see "
                "into your response. Keep visual descriptions brief but informative."
            ),
            vad=silero.VAD.load(),
            stt=deepgram.STT(),
            llm=openai.LLM(model="gpt-4o-mini"),
            tts=cartesia.TTS(),
        )
        self._room = room

    async def on_user_turn_completed(
        self, chat_ctx: ChatContext, new_message: ChatMessage
    ) -> None:
        """
        Callback that runs right before the LLM generates a response.
        Captures the current video frame and adds it to the conversation context.
        """
        logger.info("calling on_user_turn_completed")
        chat_ctx = chat_ctx.copy()

        latest_image = await get_latest_image(self._room)
        if latest_image:
            image_content = ImageContent(image=latest_image)
            new_message.content.append(image_content)
            logger.debug("Added latest frame to conversation context")

        chat_ctx.items.append(new_message)
        await self.update_chat_ctx(chat_ctx)


async def entrypoint(ctx: JobContext):
    logger.info(f"connecting to room {ctx.room.name}")
    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)

    # Wait for the first participant to connect
    participant = await ctx.wait_for_participant()
    logger.info(f"starting voice assistant for participant {participant.identity}")

    session = AgentSession(
        min_endpointing_delay=0.5,
        max_endpointing_delay=5.0,
    )

    await session.start(
        room=ctx.room,
        agent=Assistant(ctx.room),
        room_input_options=room_io.RoomInputOptions(
            noise_cancellation=noise_cancellation.BVC(),
        ),
    )

    # The agent should be polite and greet the user when it joins :)
    await session.say("Hey, how can I help you today?", allow_interruptions=True)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
