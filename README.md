# Q's Tabletop

Online board games to play with friends, all in one place. Pick a game, create a room, share the link, and play in any browser on desktop or mobile.

**Play:** https://q.tabletop-online.workers.dev

| Game | Folder | Live at | |
|---|---|---|---|
| **Stronghold**: medieval engine building (Splendor-style), 2–4 players | [games/stronghold](games/stronghold) | https://stronghold.tabletop-online.workers.dev | live |
| **Mercia**: tile laying (Carcassonne-style), 2–5 players | [games/mercia](games/mercia) | https://mercia.tabletop-online.workers.dev | new |
| **Whispers**: a witch hunt (Werewolf-style hidden roles), 5–16 players | [games/whispers](games/whispers) | https://whispers.tabletop-online.workers.dev | new |
| **Kintsugi**: tile drafting (Azul-style), 2–4 players | [games/kintsugi](games/kintsugi) | https://kintsugi.tabletop-online.workers.dev | new |
| **Skyline**: hotel chains and shares (Acquire-style), 2–6 players | [games/skyline](games/skyline) | https://skyline.tabletop-online.workers.dev | in the workshop |
| **Red Harbor**: a Mars-colony economy (Le Havre-style), 2–5 players | [games/red-harbor](games/red-harbor) | https://red-harbor.tabletop-online.workers.dev | in the workshop |
| **The hall**: the menu of games | [hall](hall) | https://q.tabletop-online.workers.dev | |

**Stack:** TypeScript · React 19 + Vite 8 · Cloudflare Workers + Durable Objects (via `partyserver`) · Vitest. Everything runs on the Workers free plan.

## Layout

```
hall/               The menu of games: one static page (public/index.html), Worker "q".
games/<game>/       One folder per game, each its own Cloudflare Worker with its own rooms:
  src/shared/         rules engine, bots and theme (pure, shared by client and server)
  src/server/         the Worker and the room's Durable Object (holds and saves each game)
  src/client/         React UI: Home → Lobby → Game
  test/               rules and bot tests
package.json        npm workspaces: one install for everything
```

Each game is independent: deploying or breaking one never touches another, and each keeps its own address and saved rooms. Games link back to the hall with "← All games" on their home screen.

## Work on it

```sh
npm install                      # once, at the top of the repo
npm run dev -w games/mercia      # one game at http://localhost:5173
npm run dev -w hall              # the hall at http://localhost:5200
npm test                         # every game's tests
npm run typecheck                # every game
```

Each browser tab is a separate player, so you can test a whole game in several tabs, or add bots in the lobby.

## Deploy

### Automatically, on push (recommended)

Each Worker is connected to this repo with **Cloudflare Workers Builds**. In the Cloudflare dashboard, open the Worker → **Settings → Builds → Connect**, choose this repository and branch `main`, then set:

| Setting | Value (Mercia shown; swap the folder for each Worker) |
|---|---|
| Root directory | `/` (the top of the repo, so the shared install works) |
| Build command | `npm ci` |
| Deploy command | `npm run deploy -w games/mercia` |
| Build watch paths | `games/mercia/*` and `package-lock.json` |

For the hall: deploy command `npm run deploy -w hall`, watch path `hall/*`.

A push to `main` then deploys only the Workers whose folder changed. Pushes to other branches can upload preview versions to test before they go live.

### By hand

```sh
npx wrangler login                 # once
npm run deploy -w games/mercia     # → https://mercia.tabletop-online.workers.dev
npm run deploy -w hall             # → https://q.tabletop-online.workers.dev
```

## Add a game

1. Copy a game folder (Mercia is the newest) to `games/<new-game>`.
2. Rename it in `package.json`, and in `wrangler.jsonc` set `name` (its address) and the Durable Object class. Keep the class name stable once deployed: rooms are stored under it.
3. Replace `src/shared` with the new rules, then adapt the client.
4. Add a card to `GAMES` in [hall/public/index.html](hall/public/index.html) (`soon: true` until it's deployed).
5. Connect its Worker to Workers Builds as above.

## Next: share the common code

The games still each carry their own copy of the plumbing they have in common: the room server, lobby, rejoining, coats of arms, wax seal, sounds and base styles. The plan is to move these, one piece at a time, into `packages/common`, so a fix lands in every game at once and a new game starts from it.
