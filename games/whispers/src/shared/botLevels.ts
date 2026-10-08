// Bots come in one kind for now: plain villagers of Thornwick who play
// sensibly. The level type stays so the lobby and server share one shape
// with the other games.

export const BOT_LEVELS = ['normal'] as const;
export type BotLevel = (typeof BOT_LEVELS)[number];

export const BOT_LEVEL_INFO: Record<BotLevel, { rank: string; label: string; blurb: string }> = {
  normal: { rank: 'Villager', label: 'Bot', blurb: 'Acts sensibly at night and votes on simple suspicion. Says little.' },
};

export const isBotLevel = (x: unknown): x is BotLevel => typeof x === 'string' && (BOT_LEVELS as readonly string[]).includes(x);
