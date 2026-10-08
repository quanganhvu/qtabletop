# Mercia

A tile-laying game of the Anglo-Saxon kingdom of the "border people", for 2–5 friends: an online take on Carcassonne, in the same walnut-and-gold style as Stronghold.

**Play it:** https://mercia.tabletop-online.workers.dev (or pick it from all the games at https://q.tabletop-online.workers.dev). Create a room, share the link, and play in any browser on desktop or mobile.

**Stack:** TypeScript · React 19 + Vite 8 · Cloudflare Workers + Durable Objects (via `partyserver`) · Vitest

## Run locally

From the top of the repo:

```sh
npm install
npm run dev -w games/mercia     # http://localhost:5173
```

Each browser tab acts as a separate player, so you can test a whole game in several tabs. You can also add bots in the lobby to play alone.

## Test

```sh
npm test -w games/mercia        # rules engine and bot tests
npm run typecheck -w games/mercia
```

## Deploy (free)

```sh
npm run deploy -w games/mercia  # → https://mercia.<your-subdomain>.workers.dev
```

## How it works

```
src/shared/tiles.ts     The 72 land tiles as data: each edge is split into three "ports", and each feature
                        (city, road, meadow, abbey) lists the ports it touches and where a follower stands.
src/shared/game.ts      Rules engine: placement, following features across tiles, scoring, the end-game farms.
                        Pure functions shared by client and server.
src/shared/bot.ts       Bots: try every legal placement and follower on a copy of the game and keep the best.
src/shared/theme.ts     Everything players read: game name, feature and follower names, seat colors, bot names.
src/client/art/tiles.ts Tile art, drawn from the tile data, so the pictures always agree with the rules.
src/client/Board.tsx    The land: drag to pan; pinch, scroll or +/− to zoom; glowing squares show where your tile fits.
src/server/index.ts     Worker + TileRoom Durable Object: one per room code, holds and saves the game, runs bots.
src/client/             React UI: Home → Lobby → Game.
```

- **Moves:** the server has the final say. Clients send one move per turn ("lay this tile here, turned so, with a knight on the city"), and the server checks it against the rules.
- **Hidden tiles:** the order of the face-down tiles never leaves the server; everyone sees the tile in hand.
- **Scoring:** cities 2 per tile and pennant when finished (1 each at the end), roads 1 per tile, abbeys 9 when surrounded, farms 3 per finished city they touch at the end. Most followers on a feature takes the points; ties all score.
- **Bots:** three ranks, Squire, Knight and Lord. They play about 2.5 seconds into their turn, on the server, so a game continues even if every tab is closed.
- **Not included:** expansions.
