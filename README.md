# Stronghold

A medieval take on the Splendor-style engine-building board game, for 2–4 friends.

**Play it:** https://stronghold.splendor-online.workers.dev Create a room, share the link, and play in any browser on desktop or mobile.

**Stack:** TypeScript · React 19 + Vite 8 · Cloudflare Workers + Durable Objects (via `partyserver`) · Vitest

## Run locally

```sh
npm install
npm run dev          # http://localhost:5173
```

Each browser tab acts as a separate player, so you can test a whole game in several tabs. You can also click **Add a bot** in the lobby to play alone.

## Test

```sh
npm test             # rules engine tests
npm run typecheck
```

## Deploy (free)

You need a free Cloudflare account. No credit card is required.

```sh
npx wrangler login   # one time
npm run deploy       # → https://stronghold.<your-subdomain>.workers.dev
```

The site, the API and every game room run on the Workers free plan. Rooms sleep when idle, and their state stays saved.

## How it works

```
src/shared/game.ts      Rules engine: the 90 cards, 10 nobles and every rule. Pure functions shared by client and server.
src/shared/theme.ts     Everything players read: resource names, places, noble houses, bot names. Re-skin the game here.
src/client/art/         Vector art: card scenes (scenes.ts), coats of arms (houses.ts) and resource emblems (icons.tsx).
src/shared/bot.ts       Greedy bot: buys the best affordable card, otherwise collects gems toward a target card.
src/shared/protocol.ts  WebSocket message types.
src/server/index.ts     Worker + SplendorRoom Durable Object. Each room code gets one object, which holds
                        and saves that room's game and validates every move.
src/client/             React UI: Home → Lobby → Game.
```

- **Moves:** the server has the final say. Clients send intents such as "buy card c12", and the server checks them against the rules.
- **Hidden cards:** a card reserved face-down from a deck stays hidden from the other players, as in the real game.
- **Leaving and rejoining:** refreshing the page or losing the connection puts you back in your seat. If someone leaves for good, a spectator can click **Take seat** to continue for them.
- **Bots:** they run on the server and play about 1 second after their turn begins, so a game continues even if every tab is closed.
- **End of game:** when a player reaches 15 points, the round is finished so everyone gets the same number of turns. A tie on points goes to the player with fewer development cards.
