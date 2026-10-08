import type { ReactNode } from 'react';
import type { Role } from '../shared/game';
import type { Arms } from '../shared/heraldry';
import { ROLES } from '../shared/theme';
import { armsUrl } from './art/heraldry';
import { roleArt } from './art/roles';

export const Num = ({ children }: { children: ReactNode }) => <span className="num">{children}</span>;

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

export function Crest({ arms, size = 28, title }: { arms: Arms; size?: number; title?: string }) {
  return (
    <span
      className="crest"
      role="img"
      aria-label={title ?? 'Coat of arms'}
      title={title}
      style={{ width: size, height: size * 1.1, backgroundImage: armsUrl(arms) }}
    />
  );
}

/** A role's emblem, or a sealed crescent when the role is secret. */
export function RoleEmblem({ role, size = 32, className }: { role: Role | null; size?: number; className?: string }) {
  return (
    <span
      className={cx('role-emblem', className)}
      role="img"
      aria-label={role ? ROLES[role].name : 'Unknown role'}
      title={role ? ROLES[role].name : 'Unknown'}
      style={{ width: size, height: size, backgroundImage: roleArt(role) }}
    />
  );
}
