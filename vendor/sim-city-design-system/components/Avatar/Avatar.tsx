import type { HTMLAttributes, JSX } from 'react';
import { cx } from '../../lib/cx';
import './Avatar.css';

export type AvatarSize = 16 | 24 | 32 | 48;

export interface AvatarProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Names the person: the image's alt text and the source of the initials. */
  name: string;
  src?: string;
  size?: AvatarSize;
}

/** First letters of the first and last words, e.g. "Ada M. Grover" -> "AG". */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export function Avatar({ name, src, size = 32, className, ...rest }: AvatarProps): JSX.Element {
  /* At 16px there is room for one letter between the bevels, and no more. */
  const initials = initialsOf(name).slice(0, size === 16 ? 1 : 2);
  return (
    <span className={cx('sc-avatar', `sc-avatar--${size}`, className)} {...rest}>
      {src ? (
        <img className="sc-avatar__image" src={src} alt={name} width={size} height={size} />
      ) : (
        <span className="sc-avatar__initials" role="img" aria-label={name}>
          {initials}
        </span>
      )}
    </span>
  );
}
