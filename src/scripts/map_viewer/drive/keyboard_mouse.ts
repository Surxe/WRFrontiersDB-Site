/**
 * Keyboard and mouse to the movement's plain input state, while the pointer
 * is locked on the viewer's canvas (the same lock fly mode uses):
 * WASD / arrows move, the mouse looks, Space (held) is the Jump Jet, Left
 * Shift is Dash Thrusters (the game's default bindings, BINDINGS). Number
 * keys pick a speed tier (0: the game's blend) and T respawns; both are
 * reported through callbacks.
 *
 * Space is claimed (preventDefault on down and up) and focus is taken off
 * the page's buttons when the pointer is captured: otherwise Space
 * activates the focused button, which after going fullscreen is the
 * viewer's fullscreen toggle (08-prototype.md, "Known issues").
 */
import type { InputState } from '../../movement/input/input_state';

/** Degrees of view turn per pixel of mouse movement (a UI setting). */
const MOUSE_DEGREES_PER_PIXEL = 0.15;
const MAX_PITCH = 80;

/**
 * The game's default bindings for the movement inputs, in one table.
 * Dash: Left Shift (firing-range item K1, recorded by Ethan 2026-11-22).
 */
export const BINDINGS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  right: ['KeyD', 'ArrowRight'],
  left: ['KeyA', 'ArrowLeft'],
  jump: ['Space'],
  dash: ['ShiftLeft'],
} as const;

const FORWARD = new Set<string>(BINDINGS.forward);
const BACK = new Set<string>(BINDINGS.back);
const RIGHT = new Set<string>(BINDINGS.right);
const LEFT = new Set<string>(BINDINGS.left);
const JUMP = new Set<string>(BINDINGS.jump);
const DASH = new Set<string>(BINDINGS.dash);

export interface InputCallbacks {
  /** A digit key: 1-9 use tier 0-8 alone, 0 returns to the game's blend. */
  onTier(index: number | null): void;
  onRespawn(): void;
  /** H: show or hide the overlay's details. */
  onToggleDetails(): void;
}

export class KeyboardMouseInput {
  private readonly held = new Set<string>();
  private yaw = 0;
  private pitch = -15;
  private readonly abort = new AbortController();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly callbacks: InputCallbacks
  ) {
    const signal = this.abort.signal;
    document.addEventListener('keydown', (event) => this.onKey(event, true), {
      signal,
    });
    document.addEventListener('keyup', (event) => this.onKey(event, false), {
      signal,
    });
    document.addEventListener('mousemove', (event) => this.onMouse(event), {
      signal,
    });
    // A key released while the window is away never sends its keyup.
    window.addEventListener('blur', () => this.held.clear(), { signal });
    document.addEventListener(
      'pointerlockchange',
      () => {
        if (!this.locked) this.held.clear();
        else if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
      },
      { signal }
    );
  }

  get locked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  /** Face `yaw` (UE degrees), e.g. the spawn's direction. */
  lookAt(yaw: number): void {
    this.yaw = yaw;
  }

  state(): InputState {
    const axis = (plus: Set<string>, minus: Set<string>): number =>
      Number([...plus].some((k) => this.held.has(k))) -
      Number([...minus].some((k) => this.held.has(k)));
    return {
      forward: axis(FORWARD, BACK),
      right: axis(RIGHT, LEFT),
      viewYaw: this.yaw,
      viewPitch: this.pitch,
      jump: [...JUMP].some((k) => this.held.has(k)),
      dash: [...DASH].some((k) => this.held.has(k)),
    };
  }

  dispose(): void {
    this.abort.abort();
  }

  private onKey(event: KeyboardEvent, down: boolean): void {
    if (!this.locked) return;
    const code = event.code;
    if (
      FORWARD.has(code) ||
      BACK.has(code) ||
      RIGHT.has(code) ||
      LEFT.has(code) ||
      JUMP.has(code) ||
      DASH.has(code)
    ) {
      event.preventDefault();
      if (down) this.held.add(code);
      else this.held.delete(code);
      return;
    }
    if (!down || event.repeat) return;
    const digit = /^Digit([0-9])$/.exec(code);
    if (digit) {
      event.preventDefault();
      const n = Number(digit[1]);
      this.callbacks.onTier(n === 0 ? null : n - 1);
    } else if (code === 'KeyT') {
      event.preventDefault();
      this.callbacks.onRespawn();
    } else if (code === 'KeyH') {
      event.preventDefault();
      this.callbacks.onToggleDetails();
    }
  }

  private onMouse(event: MouseEvent): void {
    if (!this.locked) return;
    // UE yaw grows turning right; pitch grows looking up.
    this.yaw = (this.yaw + event.movementX * MOUSE_DEGREES_PER_PIXEL) % 360;
    this.pitch = Math.max(
      -MAX_PITCH,
      Math.min(
        MAX_PITCH,
        this.pitch - event.movementY * MOUSE_DEGREES_PER_PIXEL
      )
    );
  }
}
