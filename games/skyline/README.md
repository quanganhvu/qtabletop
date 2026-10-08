# Skyline

A take on the classic hotel-chain game *Acquire*, for 2–6 friends.

**Stack:** TypeScript · React 19 + Vite 8 · Cloudflare Workers + Durable Objects (via `partyserver`) · Vitest

## Run locally

```sh
npm install
npm run dev          # http://localhost:5173
```

Each browser tab acts as a separate player, so you can test a whole game in several tabs. You can also click **Add a bot** in the lobby to play alone.

## Test

```sh
npm test             # rules engine and bot tests
npm run typecheck
```

## Deploy (free)

```sh
npx wrangler login   # one time
npm run deploy       # → https://skyline.<your-subdomain>.workers.dev
```

## How it works

```
src/shared/game.ts      Rules engine: board, tiles, founding, mergers, bonuses, buying, game end. Pure functions shared by client and server.
src/shared/theme.ts     Everything players read: game name, chain names and colors, bot names. Re-skin the game here.
src/shared/bot.ts       Bot: tries each playable tile on a copy of the game and keeps the one that leaves it richest against its rivals.
src/shared/protocol.ts  WebSocket message types.
src/server/index.ts     Worker + AcquireRoom Durable Object. Each room code gets one object, which holds and saves that room's game.
src/client/Board.tsx    The 3D board: drag to orbit; each chain rises into its own style of building (PROFILES) that grows with the chain.
src/client/             React UI: Home → Lobby → Game.
```

- **Moves:** the server has the final say and checks every move against the rules.
- **Hidden tiles:** you only see your own tiles; cash and shares are public.
- **Mergers:** bonuses are paid as each chain is absorbed (largest first), then each holder, starting with the merger's maker, sells, trades 2:1 or keeps.
- **Dead tiles** (would merge two safe chains) are swapped automatically at the end of your turn.
- **End:** once a chain has 41+ tiles or every chain is safe, the player on turn may end the game. If no one can play a tile any more, the game ends by itself.
- **Not implemented:** the official 2-player rule with a dummy shareholder; when tied defunct chains merge, the one listed first is settled first.
