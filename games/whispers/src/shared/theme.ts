// Display theme: the rules engine keeps short ids ('coven', 'seer', 'doctor', ...);
// everything players read comes from here, so the game can be re-skinned freely.

import type { Role, Team } from './game';

export const GAME_NAME = 'Whispers';
export const VILLAGE = 'Thornwick';

export interface RoleInfo {
  name: string;
  /** With an article, for sentences: "They were the Witchfinder." */
  a: string;
  team: Team;
  /** What the role does, for the role card. */
  power: string;
  /** When and how you act, for the role reveal. */
  when: string[];
}

export const ROLES: Record<Role, RoleInfo> = {
  coven: {
    name: 'Witch', a: 'a Witch', team: 'coven',
    power: 'Each night, agree with your coven on one villager to curse to death. By day, pass as an honest villager.',
    when: ['Every night: click a villager to choose who to curse. Agree with your coven in its secret chat.', 'Every day: blend in. Talk and vote like an innocent villager.'],
  },
  villager: {
    name: 'Villager', a: 'a Villager', team: 'village',
    power: 'No powers, only wits. Listen, question, and send the witches to the gallows.',
    when: ['Every night: nothing to do. Bar your door, and wait for dawn.', 'Every day: talk in the Village chat, then click whoever you think is a witch to vote.'],
  },
  seer: {
    name: 'Witchfinder', a: 'the Witchfinder', team: 'village',
    power: 'Each night, question one player in secret and learn whether they are a witch.',
    when: ['Every night: click a player, then press Question. The answer appears on a card and in your journal.', 'Every day: use what you know, but beware: if the coven learns who you are, you are next.'],
  },
  doctor: {
    name: 'Priest', a: 'the Priest', team: 'village',
    power: 'Each night, bless one player to shield them from curses. Never the same one two nights running.',
    when: ['Every night: click someone to bless (yourself too), then press Bless.', 'Every day: talk and vote like everyone else.'],
  },
  wisewoman: {
    name: 'Wise Woman', a: 'the Wise Woman', team: 'village',
    power: 'You learn who the coven cursed. Once a game you may brew a cure to save them, and once a poison for anyone.',
    when: ['Each night, after the coven: you are told who was cursed. Tick Cure to save them, and/or click someone to poison. Each potion works once per game.', 'Every day: talk and vote like everyone else.'],
  },
  hunter: {
    name: 'Hunter', a: 'the Hunter', team: 'village',
    power: 'If you die, by curse or by the noose, you take one last shot and someone falls with you.',
    when: ['At night: nothing to do.', 'If you die: you get 30 seconds to click a player and press Shoot.', 'Every day: talk and vote like everyone else.'],
  },
};

export const TEAM_NAMES: Record<Team, string> = { village: 'the Village', coven: 'the Coven' };

/** Bots are villagers of Thornwick. */
export const BOT_NAMES = [
  'Old Tobias', 'Widow Agnes', 'Brother Cuthbert', 'Mabel the Baker', 'Gideon Smith', 'Rowan the Shepherd',
  'Edith Thatcher', 'Silas Miller', 'Hilda Brewer', 'Jasper Fletcher', 'Martha Weaver', 'Osric Cooper',
  'Ada Chandler', 'Bertram Mason', 'Greta Fowler', 'Wilfred Tanner',
];

export const roleName = (r: Role) => ROLES[r].name;
