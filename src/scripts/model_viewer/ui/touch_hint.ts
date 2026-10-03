/**
 * The "use two fingers" hint over the inline viewer. There, one finger scrolls
 * the page past the canvas (render/viewer.ts setTouchScroll), so a one-finger
 * drag sideways, which reads as trying to orbit rather than to scroll, flashes
 * the hint (`.is-shown`, styled in ModelViewport.astro). Fullscreen turns it
 * off, as one finger moves the camera there.
 */

/** Sideways travel (px) that reads as an orbit attempt. */
const SIDEWAYS_PX = 16;
const SHOW_MS = 1800;

export class TouchHint {
  enabled = true;
  private start: { x: number; y: number } | null = null;
  private timer = 0;

  constructor(
    canvas: HTMLElement,
    private readonly hint: HTMLElement
  ) {
    canvas.addEventListener(
      'touchstart',
      (event) => {
        const touch = event.touches[0];
        this.start =
          event.touches.length === 1 && touch
            ? { x: touch.clientX, y: touch.clientY }
            : null;
      },
      { passive: true }
    );
    canvas.addEventListener(
      'touchmove',
      (event) => {
        const touch = event.touches[0];
        if (!this.enabled || !this.start || event.touches.length !== 1) return;
        if (!touch) return;
        const dx = Math.abs(touch.clientX - this.start.x);
        const dy = Math.abs(touch.clientY - this.start.y);
        if (dx > SIDEWAYS_PX && dx > dy) {
          this.start = null;
          this.show();
        }
      },
      { passive: true }
    );
  }

  private show(): void {
    this.hint.classList.add('is-shown');
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(
      () => this.hint.classList.remove('is-shown'),
      SHOW_MS
    );
  }
}
