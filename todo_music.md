# Music Cog Rewrite TODO (Wavelink 3.5.1 + Lavalink 4 + YouTube Plugin + Slash Commands)

## Core Features to Implement

- [x] Connect to Lavalink node with plugin support
- [x] Use Wavelink for all playback (no yt_dlp)
- [x] Use slash commands (`@app_commands.command`) for all commands
- [x] SQLite database for:
  - [x] Per-guild saved volume
  - [x] Per-guild DJ role
- [x] In-memory:
  - [x] Per-guild queue (using Wavelink queue)
  - [x] Per-guild history (deque)
  - [x] Per-guild looping toggle
  - [x] Per-guild autoplay toggle

## Slash Commands

- [x] `/join` - Join user's voice channel
- [x] `/leave` - Leave voice channel
- [x] `/play <query>` - Search or URL, add to queue, start if idle
- [x] `/skip` - Skip current track
- [x] `/stop` - Stop playback and clear queue
- [x] `/pause` - Pause playback
- [x] `/resume` - Resume playback
- [x] `/queue` - Show current queue
- [x] `/nowplaying` - Show current track info
- [x] `/volume [level]` - Set or get volume (0-200%)
- [x] `/loop` - Toggle looping current track
- [x] `/shuffle` - Shuffle queue
- [x] `/clear` - Clear queue
- [x] `/replay` - Replay current track from start
- [x] `/seek <seconds>` - Seek to position in current track
- [x] `/history` - Show recently played tracks
- [x] `/autoplay` - Toggle autoplay related tracks
- [x] `/setdj <role>` - Set DJ role
- [x] `/cleardj` - Clear DJ role
- [x] `/move <from> <to>` - Move track in queue
- [x] `/remove <position>` - Remove track from queue

## Playback Logic

- [x] When queue ends:
  - [x] If autoplay enabled, search related track and enqueue
  - [x] Else, disconnect
- [x] Looping:
  - [x] If enabled, re-add current track to queue

## Additional

- [x] DJ/admin permission checks for sensitive commands
- [x] Save volume changes to DB
- [x] Save DJ role changes to DB
- [x] Initialize DB tables on startup
- [x] Clean shutdown: close DB, disconnect, cleanup

---

This checklist will be used to track the rewrite progress.
