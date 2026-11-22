/**
 * Drive mode, the movement simulator's prototype on the map viewer: builds
 * collision from the loaded map, then each frame steps the movement session
 * (src/scripts/movement/) with keyboard and mouse input and draws its
 * output: a capsule wireframe, a follow camera and a debug overlay. This is
 * the only place the viewer and the simulation meet; the simulation knows
 * nothing of three.js or the page.
 *
 * Collision is built in time slices so the page keeps drawing and shows
 * progress; on CrashSite that is about 20 M triangles, ~2 GB of WebAssembly
 * memory and tens of seconds.
 */
import * as THREE from 'three';
import { fetchJson } from '../../data/fetch';
import { MovementSession, type FrameStats } from '../../movement/session';
import type { RapierCollisionWorld } from '../../movement/collision/rapier';
import { vec, size2D, type Vec3 } from '../../movement/math/vec';
import type { InputState } from '../../movement/input/input_state';
import { warnUnestablished } from '../../movement/placeholders';
import { CapsuleMesh } from './capsule_mesh';
import { placeFollowCamera } from './follow_camera';
import { KeyboardMouseInput } from './keyboard_mouse';
import { PROTOTYPE_CHASSIS, optionValues, type DriveOptions } from './options';
import { countPieces, trianglePieces } from './scene_triangles';
import { DriveOverlay } from './overlay';
import { RollingStats, summarize, type Summary } from './stats';

/** Building yields to the page after this long, ms. */
const BUILD_SLICE_MS = 30;

export interface DriveContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement;
  /** The viewer's container (the overlay goes in it). */
  container: HTMLElement;
}

export interface DriveStart {
  /** The map's base layer, already loaded. */
  base: THREE.Object3D;
  /** A spawn pin (UE cm, yaw degrees). */
  spawn: { position: readonly [number, number, number]; yaw: number };
  /** `/WRFrontiersDB-Data/current`. */
  dataRoot: string;
  options: DriveOptions;
}

export interface BuildInfo {
  pieces: number;
  colliders: number;
  triangles: number;
  seconds: number;
  wasmBytes: number | null;
}

/** What the measurement script reads (window.__wrfDrive). */
export interface DriveReport {
  build: BuildInfo | null;
  frames: number;
  summary: ReturnType<RollingStats['summary']>;
  mode: string;
  speed: number;
}

/** Measurement hooks (scripts/movement/bench.ts drives headless, where
 * there is no pointer lock). */
export interface DriveHooks {
  report(): DriveReport;
  resetStats(): void;
  /** Drive with this input instead of the keyboard and mouse (null: stop). */
  script(input: InputState | null): void;
  /** Run `steps` movement updates of `seconds` each right now, without
   * drawing, turning the view `yawPerStep` degrees each step; returns the
   * time per update. Measures collision cost independent of rendering. */
  benchSteps(
    steps: number,
    seconds: number,
    yawPerStep: number
  ): StepBench | null;
}

export interface StepBench {
  steps: number;
  /** Per update, ms: collision queries, and the whole update. */
  collisionMs: Summary;
  updateMs: Summary;
  /** Mean whole-update time from one timer around every update, ms (the
   * browser's timer is coarse, so per-update values are rounded). */
  updateMeanMs: number;
  queriesPerStep: number;
  /** Updates whose input or result was falling. */
  fallingSteps: number;
}

declare global {
  interface Window {
    __wrfDrive?: DriveHooks;
  }
}

export class DriveMode {
  private session: MovementSession | null = null;
  private world: RapierCollisionWorld | null = null;
  private readonly overlay: DriveOverlay;
  private readonly capsuleMesh: CapsuleMesh;
  private readonly input: KeyboardMouseInput;
  private readonly stats = new RollingStats();
  private build: BuildInfo | null = null;
  private lastFrame: number | null = null;
  private lastOverlay = 0;
  private lastFrameStats: FrameStats | null = null;
  private disposed = false;
  private scripted: InputState | null = null;

  private constructor(
    private readonly ctx: DriveContext,
    private readonly start: DriveStart
  ) {
    this.overlay = new DriveOverlay(ctx.container);
    this.capsuleMesh = new CapsuleMesh(start.options.capsule);
    this.capsuleMesh.group.visible = false;
    ctx.scene.add(this.capsuleMesh.group);
    this.input = new KeyboardMouseInput(ctx.canvas, {
      onTier: (index) => this.session?.setTierOverride(index),
      onRespawn: () => this.session?.respawn(),
      onToggleDetails: () => this.overlay.toggleDetails(),
    });
    this.input.lookAt(start.spawn.yaw);
    window.__wrfDrive = {
      report: () => this.report(),
      resetStats: () => this.stats.reset(),
      script: (input) => {
        this.scripted = input;
      },
      benchSteps: (steps, seconds, yawPerStep) =>
        this.benchSteps(steps, seconds, yawPerStep),
    };
  }

  /** Create drive mode and build its collision in the background. */
  static create(ctx: DriveContext, start: DriveStart): DriveMode {
    const drive = new DriveMode(ctx, start);
    drive.load().catch((err: unknown) => {
      console.error('drive mode failed:', err);
      drive.overlay.showError(err instanceof Error ? err.message : String(err));
    });
    return drive;
  }

  get ready(): boolean {
    return this.session !== null;
  }

  private async load(): Promise<void> {
    const { dataRoot, base, options } = this.start;
    this.overlay.showStatus('Loading movement data and Rapier...');
    const table = (name: string): Promise<Record<string, unknown>> =>
      fetchJson<Record<string, unknown>>(`${dataRoot}/Objects/${name}.json`);
    const [movementTypes, characterModules, modules, { RapierCollisionWorld }] =
      await Promise.all([
        table('MovementType'),
        table('CharacterModule'),
        table('Module'),
        import('../../movement/collision/rapier'),
      ]);
    if (this.disposed) return;
    const world = await RapierCollisionWorld.create();
    if (this.disposed) {
      world.free();
      return;
    }
    this.world = world;

    // Build collision in slices.
    const total = countPieces(base);
    const began = performance.now();
    let added = 0;
    let sliceStart = performance.now();
    for (const piece of trianglePieces(base)) {
      world.addPiece(piece);
      added++;
      if (performance.now() - sliceStart > BUILD_SLICE_MS) {
        const elapsed = (performance.now() - began) / 1000;
        this.overlay.showStatus(
          `Building collision: ${added.toLocaleString('en')} / ${total.pieces.toLocaleString('en')} meshes ` +
            `(${Math.round((100 * added) / total.pieces)}%), ${total.triangles.toLocaleString('en')} triangles, ${elapsed.toFixed(1)} s`
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (this.disposed) return;
        sliceStart = performance.now();
      }
    }
    world.finishBuild();
    const built = world.buildStats();
    this.build = { ...built, seconds: (performance.now() - began) / 1000 };

    const { position } = this.start.spawn;
    const spawn: Vec3 = vec(
      position[0],
      position[1],
      position[2] + options.capsule.halfHeight
    );
    this.session = new MovementSession({
      collision: world,
      movementTypes,
      characterModules,
      modules,
      chassisId: PROTOTYPE_CHASSIS,
      level: options.level,
      tierOverride: options.tierOverride,
      capsule: options.capsule,
      stepSeconds: options.hz === null ? null : 1 / options.hz,
      spawn,
      params: options.params,
      values: optionValues(options),
    });
    warnUnestablished(this.session.values(), this.session.unapplied());
    this.capsuleMesh.group.visible = true;
    this.lastFrame = null;
  }

  /** Step and draw; the viewer calls this every 3D frame while driving. */
  frame(now: number): void {
    const frameSeconds =
      this.lastFrame === null ? 0 : (now - this.lastFrame) / 1000;
    const frameMs = this.lastFrame === null ? 0 : now - this.lastFrame;
    this.lastFrame = now;
    const session = this.session;
    if (!session) return;
    // Keys only count while the mouse is captured; the view always does.
    const view = this.scripted ?? this.input.state();
    const input =
      this.scripted || this.input.locked
        ? view
        : { ...view, forward: 0, right: 0 };
    const result = session.update(frameSeconds, input);
    this.lastFrameStats = result;
    if (frameMs > 0) {
      const q = result.queries;
      this.stats.add({
        frameMs,
        simMs: result.simMs,
        collisionMs: q.ms,
        collisionMsPerStep: result.steps > 0 ? q.ms / result.steps : 0,
        queries: q.sweeps + q.lineTraces + q.overlaps,
        steps: result.steps,
      });
    }

    const m = session.movement;
    const center = session.renderLocation(result.alpha);
    const floor = m.currentFloor;
    const foot = vec(center.x, center.y, center.z - m.capsule.halfHeight);
    this.capsuleMesh.update(
      center,
      m.isFalling(),
      foot,
      floor.isWalkableFloor() ? floor.hitResult.impactNormal : null
    );
    placeFollowCamera(
      this.ctx.camera,
      center,
      m.capsule,
      view.viewYaw,
      view.viewPitch
    );

    if (now - this.lastOverlay > 100) {
      this.lastOverlay = now;
      this.overlay.showStats(
        session,
        this.stats.summary(),
        this.build,
        this.lastFrameStats,
        this.input.locked
      );
    }
  }

  private benchSteps(
    steps: number,
    seconds: number,
    yawPerStep: number
  ): StepBench | null {
    const session = this.session;
    if (!session) return null;
    const collision: number[] = [];
    const update: number[] = [];
    let queries = 0;
    let fallingSteps = 0;
    let yaw = this.input.state().viewYaw;
    const began = performance.now();
    for (let i = 0; i < steps; i++) {
      yaw += yawPerStep;
      const result = session.update(seconds, {
        forward: 1,
        right: 0,
        viewYaw: yaw,
        viewPitch: 0,
      });
      collision.push(result.queries.ms);
      update.push(result.simMs);
      queries +=
        result.queries.sweeps +
        result.queries.lineTraces +
        result.queries.overlaps;
      if (session.movement.isFalling()) fallingSteps++;
    }
    const totalMs = performance.now() - began;
    return {
      steps,
      collisionMs: summarize(collision),
      updateMs: summarize(update),
      updateMeanMs: totalMs / steps,
      queriesPerStep: queries / steps,
      fallingSteps,
    };
  }

  report(): DriveReport {
    const m = this.session?.movement;
    return {
      build: this.build,
      frames: this.stats.count,
      summary: this.stats.summary(),
      mode: m?.movementMode ?? 'loading',
      speed: m ? size2D(m.velocity) : 0,
    };
  }

  dispose(): void {
    this.disposed = true;
    this.input.dispose();
    this.overlay.dispose();
    this.capsuleMesh.dispose();
    this.world?.free();
    this.world = null;
    this.session = null;
    delete window.__wrfDrive;
  }
}
