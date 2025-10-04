# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Essential Commands
```bash
npm run dev      # Start bot in development mode with hot reload
npm run build    # Compile TypeScript to JavaScript for production
npm run start    # Run compiled JavaScript version
npm run typecheck # Check TypeScript types without compiling
```

### Testing and Debugging
```bash
# View VAD calibration logs in real-time
npm run dev | grep '\[VADDBG\]'

# Check validation/kick skips
npm run dev | grep '\[skip\]'

# Monitor slash command interactions
npm run dev | grep '\[interaction\]'
```

## Architecture Overview

This is a TypeScript Discord voice bot with advanced Voice Activity Detection (VAD) that automatically kicks inactive users from voice channels.

### Core Architecture

**Modular TypeScript Structure:**
- `src/index.ts` - Main bootstrap, registers all Discord event handlers
- `src/config.ts` - Centralized environment configuration with VAD parameters
- `src/bot/client.ts` - Discord client with required intents
- `src/bot/voice/` - Voice processing modules (VAD, connections, audio, kick logic)
- `src/bot/commands/` - Slash commands (`/entrar`, `/sair`) with REST API deployment
- `src/events/` - Discord event handlers (messageCreate, voiceStateUpdate, interactionCreate)

**Key Design Patterns:**
- **Robust Channel Validation**: Bot only operates when `ready` and in same voice channel as user
- **Elegibility System**: Users can only be kicked once per session until they leave/rejoin
- **Multi-layer VAD**: Fast path for strong audio, moving average smoothing, frame ratio analysis
- **Automatic Cleanup**: Timeouts cancelled when bot leaves/moves channels

### Voice Activity Detection (VAD) Architecture

The VAD system uses multiple validation layers to prevent false positives:

1. **Fast Path**: Instant cancellation for very strong audio (VAD_THRESHOLD_STRONG)
2. **RMS Analysis**: Real-time volume measurement with 3-frame moving average
3. **Threshold Validation**: Floor/VAD_THRESHOLD filtering with ratio requirements
4. **Sustenance Check**: Requires minimum continuous speech duration (VAD_SUSTAIN_MS)
5. **Cooldown**: Prevents jitter after confirmed speech detection

VAD state is managed globally with `Map` objects tracking user-specific data across voice sessions.

### Slash Commands vs Message Commands

**Dual Command System:**
- **Slash Commands** (`/entrar`, `/sair`): Modern Discord commands with rich embeds, buttons, and automatic deployment
- **Legacy Commands** (`!entrar`, `!sair`): Maintained for compatibility with different logging prefixes

Slash commands use `@discordjs/rest` for deployment and `RESTPostAPIApplicationCommandsJSONBody` typing.

### Critical Validation Functions

**`botInSameVoiceChannelNow(guild, channelId)`**: Core validation ensuring bot is both:
- Connection state `status === "ready"`
- Bot member is actually in the target voice channel (`guild.members.me.voice.channelId`)

This function is called at multiple points:
- Before scheduling kicks
- Before playing audio
- In timeout execution before disconnecting users

### State Management

**Global Maps:**
- `pendingKicks` - Tracks active timeout handles for cancellation
- `eligibleForKick` - Manages user kick eligibility per session
- `vadState` - VAD timing and confirmation state per user
- `rmsHist` - Moving average history for smooth audio analysis

**Voice Connection Management:**
- Connection state monitoring with debug logging
- Automatic retry logic for failed connections
- Graceful handling of disconnections and moves

## Important Implementation Details

### Voice Connection Requirements
Bot requires specific Discord permissions: `Move Members`, `Connect`, `Speak`, `Read Messages/View Channels`, `Send Messages`

### Environment Configuration
Key VAD parameters in `.env`:
- `VAD_THRESHOLD=3000` - Normal speech detection threshold
- `VAD_FLOOR=1200` - Noise floor filtering
- `VAD_THRESHOLD_STRONG=7000` - Instant cancellation threshold
- `VAD_SUSTAIN_MS=150` - Minimum sustained speech duration

### Audio Processing
- Uses `@discordjs/voice` with Opus decoding via `prism-media`
- Plays `assets/contagem.ogg` when scheduling kicks
- Audio only plays when bot is properly connected and ready

### Event Flow
1. `voiceStateUpdate` - Triggers on user join/leave/move
2. `scheduleKick` - Validates bot state, schedules timeout, plays audio
3. `VAD processing` - Monitors audio, cancels kick on speech detection
4. `timeout execution` - Revalidates all states before disconnecting user

### Error Handling
- Comprehensive error logging for voice connections
- Graceful fallbacks for missing permissions
- Automatic timeout cleanup to prevent memory leaks

## Future Enhancements (Planned)

### Configuration System
**SQLite Per-Server Architecture:**
- Each Discord server gets its own SQLite database file
- Store server-specific settings: timeout values, VAD thresholds, enabled channels
- User statistics: kick counts, average speaking time, warnings
- Guild preferences: exempt roles, notification settings, custom messages
- Database migrations using versioned schema files
- `better-sqlite3` for synchronous database operations

**Planned Configuration Tables:**
```sql
-- Guild settings
CREATE TABLE guild_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User statistics
CREATE TABLE user_stats (
  user_id TEXT PRIMARY KEY,
  kicks_count INTEGER DEFAULT 0,
  total_speaking_time INTEGER DEFAULT 0,
  last_seen DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Implementation Structure:**
- `src/db/index.ts` - Database connection management per guild
- `src/db/migrations/` - Schema versioning and migration scripts
- `src/db/models/` - TypeScript interfaces for data models
- `src/bot/settings/` - Command handlers for configuration changes