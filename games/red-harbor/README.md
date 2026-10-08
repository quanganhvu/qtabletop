# Red Harbor (working title)

A Mars-colony economy game for 2–5 friends: an online take on Uwe Rosenberg's Le Havre, re-themed to the settling of Mars and built on the same engine as Stronghold.

Name shortlist: Red Harbor · Havre Rouge · Port Ares · Tharsis Station · Olympus Landing. Change it in `src/shared/theme.ts` (`GAME_NAME`).

**Stack:** TypeScript · React 19 + Vite 8 · Cloudflare Workers + Durable Objects (via `partyserver`) · Vitest

## Run locally

```sh
npm install
npm run cf-typegen   # one time: generates worker-configuration.d.ts
npm run dev          # http://localhost:5173
```

Each browser tab acts as a separate player, so you can test a whole game in several tabs. You can also add bots in the lobby to play alone.

## Test

```sh
npm test             # rules engine and bot tests
npm run typecheck
```

## Deploy (free)

```sh
npx wrangler login   # one time
npm run deploy       # → https://le-havre.<your-subdomain>.workers.dev
```

## How it works

```
src/shared/theme.ts     Everything players read: game name, goods names, place names, bot names. Re-skin the game here.
src/shared/goods.ts     The 17 goods (credits, 8 raw, 8 refined), food/energy/credit values, payment helpers.
src/shared/data.ts      Card data: buildings, ships, round cards, supply chits. Balance the game here.
src/shared/game.ts      Rules engine: turns, rounds, feeding, loans, scoring. Pure functions shared by client and server.
src/shared/bot.ts       Bots: try every legal move on a copy of the state and keep the best-scoring one.
src/shared/flags.ts     Shipping-company house flags (players' identities).
src/shared/protocol.ts  WebSocket message types.
src/server/index.ts     Worker + HarbourRoom Durable Object: one per room code, holds and saves the game, validates moves, runs bots.
src/client/             React UI: Home → Lobby → Game. Dialogs.tsx previews each move by running it through the real engine.
```

- **Moves:** the server has the final say. Clients send intents ("use the Smokehouse on 5 fish"); illegal moves are rejected and leave the game untouched.
- **Hidden information:** supply chits stay face down until the harbour ship reaches them.
- **Feeding** happens simultaneously at the end of each round; food you can't pay becomes loans.
- **Leaving and rejoining:** refreshing puts you back in your seat. If someone leaves for good, a bot plays on and a spectator can **Take seat**.

The building list and numbers are a rendition of Le Havre's standard buildings, not an exact copy of the printed cards; everything is in `src/shared/data.ts`.
