// Display theme: the rules engine keeps neutral ids ('city', 'road', tile
// letters, seat numbers); everything players read comes from here, so the game
// can be re-skinned freely.

import type { FeatureKind } from './tiles';

export const GAME_NAME = 'Mercia';
export const POINTS_NAME = 'points';

/** What each kind of feature is called, and what a follower standing on it is called. */
export const FEATURE_NAMES: Record<FeatureKind, { name: string; plural: string; follower: string; followers: string }> = {
  city: { name: 'city', plural: 'cities', follower: 'knight', followers: 'knights' },
  road: { name: 'road', plural: 'roads', follower: 'traveller', followers: 'travellers' },
  cloister: { name: 'abbey', plural: 'abbeys', follower: 'monk', followers: 'monks' },
  field: { name: 'farm', plural: 'farms', follower: 'farmer', followers: 'farmers' },
};

export const FOLLOWER = { name: 'follower', plural: 'followers' };

/** Seat colors for followers, in seat order. `name` is shown; `fill`/`edge` draw the figure. */
export const SEAT_COLORS = [
  { name: 'crimson', fill: '#a3242c', edge: '#4a0c10' },
  { name: 'azure', fill: '#2f5aa8', edge: '#0f2048' },
  { name: 'gold', fill: '#d9ac3c', edge: '#5a4210' },
  { name: 'forest', fill: '#3d7a46', edge: '#123018' },
  { name: 'ivory', fill: '#ece2c8', edge: '#5b4c32' },
];

/** A short description of each tile type, for the log. */
const TILE_NAMES: Record<string, string> = {
  A: 'a roadside abbey', B: 'an abbey', C: 'a walled city', D: 'a city with a road', E: 'a city wall',
  F: 'a city gateway', G: 'a city gateway', H: 'a pair of city walls', I: 'a pair of city walls',
  J: 'a city with a bend', K: 'a city with a bend', L: 'a city crossroads', M: 'a city corner', N: 'a city corner',
  O: 'a city corner with a road', P: 'a city corner with a road', Q: 'a great city', R: 'a great city',
  S: 'a city gate', T: 'a city gate', U: 'a straight road', V: 'a bend in the road', W: 'a three-way junction', X: 'a crossroads',
};

export const tileName = (t: string) => TILE_NAMES[t] ?? 'tile';

export const BOT_NAMES = ['Sir Godfrey', 'Lady Rowena', 'Baron Edmund', 'Countess Matilda', 'Brother Anselm'];
