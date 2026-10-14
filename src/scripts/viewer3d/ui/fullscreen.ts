/**
 * The viewport's fullscreen toggle. Uses the Fullscreen API where the browser
 * allows it on an element, else (iPhone Safari) pins the viewport over the page
 * with CSS (class `is-pinned`). Either way the viewport carries `is-fullscreen`
 * while open, so one set of styles covers both (components/viewer/Viewport.astro); the
 * viewer's ResizeObserver refits the camera to the new size, and `onChange`
 * hands touch gestures to the camera (one finger scrolls the page otherwise). The button's label (not aria-pressed)
 * says what it will do, as its icon does. A first-person viewer passes
 * `pointerLock`: going fullscreen then also captures the mouse there, from
 * the same click, so mouse-look starts at once.
 */

export interface FullscreenLabels {
  enter: string;
  exit: string;
}

/** Page scroll is locked while the CSS fallback covers the page. */
const LOCK_CLASS = 'viewer-fullscreen-lock';

export class FullscreenToggle {
  private open = false;
  /** Open through the CSS fallback, not the Fullscreen API. */
  private pinned = false;

  constructor(
    private readonly target: HTMLElement,
    private readonly button: HTMLButtonElement,
    private readonly labels: FullscreenLabels,
    /** Called with the new state on every open and close. */
    private readonly onChange: (open: boolean) => void = () => {},
    /** Element to lock the pointer to on entering fullscreen. */
    private readonly pointerLock?: HTMLElement
  ) {
    button.addEventListener('click', () => this.toggle());
    // The API also closes on Esc / the back gesture; follow it either way.
    document.addEventListener('fullscreenchange', () => {
      if (this.pinned) return;
      this.sync(document.fullscreenElement === target);
    });
    document.addEventListener('keydown', (event) => {
      if (this.pinned && event.key === 'Escape') this.exit();
    });
    this.sync(false);
    button.hidden = false;
  }

  toggle(): void {
    if (this.open) this.exit();
    else void this.enter();
  }

  private async enter(): Promise<void> {
    // iPhone Safari leaves fullscreenEnabled undefined.
    if (document.fullscreenEnabled) {
      try {
        await this.target.requestFullscreen({ navigationUI: 'hide' });
        this.lockPointer();
        return;
      } catch (err) {
        console.warn('fullscreen refused, pinning instead:', err);
      }
    }
    this.setPinned(true);
    this.lockPointer();
  }

  private lockPointer(): void {
    if (!this.pointerLock?.requestPointerLock) return;
    // Refused (e.g. no user gesture left): the viewer's own prompt still works.
    void Promise.resolve(this.pointerLock.requestPointerLock()).catch(() => {});
  }

  private exit(): void {
    if (this.pinned) {
      this.setPinned(false);
    } else if (document.fullscreenElement) {
      void document.exitFullscreen();
    }
  }

  private setPinned(pinned: boolean): void {
    this.pinned = pinned;
    this.target.classList.toggle('is-pinned', pinned);
    document.documentElement.classList.toggle(LOCK_CLASS, pinned);
    this.sync(pinned);
  }

  private sync(open: boolean): void {
    this.open = open;
    this.target.classList.toggle('is-fullscreen', open);
    const label = open ? this.labels.exit : this.labels.enter;
    this.button.setAttribute('aria-label', label);
    this.button.title = label;
    this.onChange(open);
  }
}
