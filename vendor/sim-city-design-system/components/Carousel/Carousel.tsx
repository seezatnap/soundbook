/*
 * A rack of postcards viewed one at a time through a sunken window.
 *
 * The slide change is an instant swap — a translate stepped at steps(2), the
 * most motion the idiom allows. Auto-advance is a courtesy, not a takeover: it
 * pauses the moment a pointer or focus arrives and never runs under reduced
 * motion. Markers are real buttons in a roving-tabindex group so the arrow
 * keys walk the deck; a polite live region reads "SLIDE N OF M" back.
 */

import {
  Children,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type HTMLAttributes,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { IconButton } from '../IconButton';
import { cx } from '../../lib/cx';
import { useControllableState } from '../../lib/useControllableState';
import './Carousel.css';

export interface CarouselProps extends HTMLAttributes<HTMLDivElement> {
  /** Required: the region has to say what it is a carousel of. */
  'aria-label': string;
  /** Each child is one slide. */
  children: ReactNode;
  index?: number;
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
  /** Wrap past the ends instead of disabling the chevrons. */
  loop?: boolean;
  /**
   * Milliseconds between automatic advances. Pauses while hovered or focused
   * and does not run at all under prefers-reduced-motion.
   */
  interval?: number;
}

export function Carousel({
  'aria-label': ariaLabel,
  children,
  index,
  defaultIndex = 0,
  onIndexChange,
  loop = false,
  interval,
  className,
  ...rest
}: CarouselProps): JSX.Element {
  const slides = Children.toArray(children);
  const count = slides.length;
  const [rawIndex, setIndex] = useControllableState(index, defaultIndex, onIndexChange);
  const current = Math.min(Math.max(rawIndex, 0), Math.max(count - 1, 0));

  const viewportId = useId();
  const markerRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  /* Reduced motion means no self-driving chrome, full stop. */
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (event: MediaQueryListEvent): void => setReducedMotion(event.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const paused = hovered || focused;
  const autoRotating = Boolean(interval) && !paused && !reducedMotion && count > 1;

  useEffect(() => {
    if (!interval || paused || reducedMotion || count < 2) return;
    /* Auto-advance always wraps: a rotation with a dead end is a countdown. */
    const timer = window.setInterval(() => setIndex((current + 1) % count), interval);
    return () => window.clearInterval(timer);
  }, [interval, paused, reducedMotion, count, current, setIndex]);

  const atStart = current === 0;
  const atEnd = current === count - 1;

  const goPrev = (): void => setIndex(atStart ? count - 1 : current - 1);
  const goNext = (): void => setIndex(atEnd ? 0 : current + 1);

  const onMarkerKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = loop ? (current + 1) % count : Math.min(current + 1, count - 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = loop ? (current - 1 + count) % count : Math.max(current - 1, 0);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = count - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    if (next === current) return;
    setIndex(next);
    markerRefs.current[next]?.focus();
  };

  const onBlur = (event: FocusEvent<HTMLDivElement>): void => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
  };

  return (
    <div
      {...rest}
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      className={cx('sc-carousel', className)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={onBlur}
    >
      <div id={viewportId} className="sc-carousel__viewport">
        <div
          className="sc-carousel__track"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {slides.map((slide, i) => (
            <div
              key={i}
              role="group"
              aria-roledescription="slide"
              aria-label={`Slide ${i + 1} of ${count}`}
              aria-hidden={i !== current || undefined}
              inert={i !== current}
              className="sc-carousel__slide"
            >
              {slide}
            </div>
          ))}
        </div>
      </div>

      <div className="sc-carousel__controls">
        <IconButton
          size="sm"
          icon="chevron-left"
          label="Previous slide"
          aria-controls={viewportId}
          disabled={!loop && atStart}
          onClick={goPrev}
        />
        <div
          role="group"
          aria-label="Choose slide"
          className="sc-carousel__markers"
          onKeyDown={onMarkerKeyDown}
        >
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              ref={(node) => {
                markerRefs.current[i] = node;
              }}
              className={cx('sc-carousel__marker', i === current && 'sc-carousel__marker--current')}
              aria-label={`Slide ${i + 1}`}
              aria-current={i === current ? 'true' : undefined}
              tabIndex={i === current ? 0 : -1}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
        <IconButton
          size="sm"
          icon="chevron-right"
          label="Next slide"
          aria-controls={viewportId}
          disabled={!loop && atEnd}
          onClick={goNext}
        />
      </div>

      {/* Silent while auto-rotating, per the APG: a metronome narrating itself
          would talk over everything else. */}
      <div className="sr-only" aria-live={autoRotating ? 'off' : 'polite'} aria-atomic="true">
        SLIDE {current + 1} OF {count}
      </div>
    </div>
  );
}
