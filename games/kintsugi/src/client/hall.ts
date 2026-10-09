// The game hall (Q's Tabletop) lists all the games. It lives next to this game
// on the same workers.dev subdomain: <game>.<sub>.workers.dev → q.<sub>.workers.dev.

const HALL_WORKER = 'q';
const DEFAULT_SUBDOMAIN = 'tabletop-online';

export function hallUrl(): string {
  const host = location.hostname;
  const sub = host.endsWith('.workers.dev') ? host.split('.').slice(1, -2).join('.') : DEFAULT_SUBDOMAIN;
  return `https://${HALL_WORKER}.${sub}.workers.dev/`;
}
