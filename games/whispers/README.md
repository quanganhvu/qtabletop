# Whispers

A witch hunt for 5–16 friends: a coven of witches hides among the villagers of Thornwick. Each night they curse someone to death; each day the village talks, accuses, and hangs whoever it suspects. An online take on the party game Werewolf, with the app as the moderator.

**Play it:** https://whispers.tabletop-online.workers.dev (or pick it from all the games at https://q.tabletop-online.workers.dev). Create a room, share the link, add bots to fill the table if you like, and play in any browser on desktop or mobile.

**Stack:** TypeScript · React 19 + Vite 8 · Cloudflare Workers + Durable Objects (via `partyserver`) · Vitest

## Run locally

From the top of the repo:

```sh
npm install
npm run dev -w games/whispers      # http://localhost:5173
```

Each browser tab is a separate player. `?sounds` on the local preview adds a panel to hear every sound and see every death effect.

## Test

```sh
npm test -w games/whispers         # rules, secrecy, chat and bot games at every table size
npm run typecheck -w games/whispers
```

## Deploy (free)

```sh
npm run deploy -w games/whispers   # → https://whispers.<your-subdomain>.workers.dev
```

## How it works

```
src/shared/game.ts      Rules engine and moderator: roles, night actions, the Wise Woman, dawn, voting, the Hunter,
                        win checks, chat rules, and viewFor(), which strips every secret a player may not know.
src/shared/bot.ts       Bots: sensible night choices, votes on simple suspicion; a bot Witchfinder outs a witch it has found.
src/shared/theme.ts     Everything players read: role names, powers and how to play them, the village, bot names.
src/server/index.ts     Worker + VillageRoom Durable Object. Phase deadlines and bot moves run on the storage alarm,
                        so a game keeps moving even while the room sleeps.
src/client/             React UI: Home → Lobby → Game (role card and journal, the village square, chat).
src/client/art/roles.ts Role emblems, moon and sun. DeathFx.tsx: the curse, the gallows, the arrow, the poison.
```

- **Roles:** Witches (the coven), Villagers, the Witchfinder (questions someone each night), the Priest (blesses someone against curses), the Wise Woman (one cure, one poison) and the Hunter (shoots someone when they die). The mix scales with the table and is shown in the lobby.
- **Secrets:** the server sends each player only their own role, their coven (if a witch), the dead's revealed roles, and their private findings. The coven's chat reaches only the coven.
- **Timers:** night 60s, day 3 min, the Wise Woman and the Hunter 30s each. The host can close the day's vote early.
