/**
 * Drive mode, the movement simulator on the map viewer: loads the map's
 * collision export (`Maps/<Map>.collision.bin`, what the game's movement
 * capsule blocks on) into the exact collision world, then each frame steps
 * the movement session (src/scripts/movement/) with keyboard and mouse
 * input and draws its output: a capsule wireframe, a follow camera and a
 * debug overlay. This is the only place the viewer and the simulation
 * meet; the simulation knows nothing of three.js or the page.
 *
 * Collision is the parts a match of the shown mode loads: `base`, the
 * mode's sublevels and one lighting variant (`lighting=`, default the
 * heaviest weight). On CrashSite it builds in about 0.1 s.
 */
import * as THREE from 'three';
import { fetchJson } from '../../data/fetch';
import { MovementSession, type FrameStats } from '../../movement/session';
import { parseCollisionFile } from '../../movement/data/collision_file';
import { collidersFromFile } from '../../movement/collision/export_loader';
import { ExactCollisionWorld } from '../../movement/collision/exact/world';
import { COLLISION_KNOWN_GAPS } from '../../movement/collision/known_gaps';
import { ENGINE_KNOWN_GAPS } from '../../movement/engine/known_gaps';
import { RULES_KNOWN_GAPS } from '../../movement/rules/tuned_movement';
import { ABILITY_KNOWN_GAPS } from '../../movement/rules/abilities/known_gaps';
import { startPoint } from '../../movement/start_point';
import {
  parseCharacterMovement,
  parseFuelResource,
} from '../../movement/data/character';
import { parseMapPhysics } from '../../movement/data/map_physics';
import { worldSetup } from '../../movement/world_setup';
import { vec, size2D, type Vec3 } from '../../movement/math/vec';
import type { InputState } from '../../movement/input/input_state';
import {
  warnUnestablished,
  type ValueProvenance,
} from '../../movement/placeholders';
import { CapsuleMesh } from './capsule_mesh';
import { placeFollowCamera } from './follow_camera';
import { KeyboardMouseInput } from './keyboard_mouse';
import { PROTOTYPE_CHASSIS, optionValues, type DriveOptions } from './options';
import { DriveOverlay } from './overlay';
import { RollingStats, summarize, type Summary } from './stats';

export interface DriveContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement;
  /** The viewer's container (the overlay goes in it). */
  container: HTMLElement;
}

type Point = readonly [number, number, number];

export interface DriveStart {
  /** `Maps/<Map>.collision.bin`, relative to `dataRoot` (Map.json
   * `files.collision`). */
  collisionFile: string;
  /** The map's `Map.json` key and its `physics` entry. */
  mapId: string;
  physics: unknown;
  /** The game mode shown (a key of the file's `modes`); null: none. */
  mode: string | null;
  /** A spawn pin (UE cm, yaw degrees); null when the mode has none. */
  spawn: { position: Point; yaw: number } | null;
  /** The pins' playable box, for a start when there is no spawn. */
  playableBox: readonly [Point, Point] | null;
  /** `/WRFrontiersDB-Data/current`. */
  dataRoot: string;
  options: DriveOptions;
}

export interface BuildInfo {
  colliders: number;
  /** Mesh triangles plus heightfield cell triangles. */
  triangles: number;
  seconds: number;
  /** Typed-array bytes the collision world holds. */
  bytes: number;
  /** What was loaded (the details list shows it). */
  parts: string;
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

/** Fetch a binary file (the collision export). */
async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.arrayBuffer();
}

export class DriveMode {
  private session: MovementSession | null = null;
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
  /** Collision and start values for the details list. */
  private collisionValues: ValueProvenance[] = [];

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
    this.input.lookAt(start.spawn?.yaw ?? 0);
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
    const { dataRoot, options, collisionFile, mode, mapId, physics } =
      this.start;
    this.overlay.showStatus('Loading movement data and collision...');
    const table = (name: string): Promise<Record<string, unknown>> =>
      fetchJson<Record<string, unknown>>(`${dataRoot}/Objects/${name}.json`);
    const [
      movementTypes,
      characterModules,
      modules,
      characters,
      abilities,
      collisionBytes,
    ] = await Promise.all([
      table('MovementType'),
      table('CharacterModule'),
      table('Module'),
      table('Character'),
      table('Ability'),
      fetchBytes(`${dataRoot}/${collisionFile}`),
    ]);
    if (this.disposed) return;
    const engine = worldSetup(
      parseCharacterMovement(characters),
      parseMapPhysics(physics, mapId),
      mapId
    );

    this.overlay.showStatus('Building collision...');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const began = performance.now();
    const file = parseCollisionFile(collisionBytes);
    const loaded = collidersFromFile(file, {
      mode,
      lighting: options.lighting,
    });
    const world = new ExactCollisionWorld(loaded.set);
    const built = world.buildStats();
    const { selection } = loaded;
    const parts =
      `base` +
      (selection.mode ? ` + mode ${selection.mode}` : '') +
      (selection.lighting ? ` + lighting ${selection.lighting}` : '');
    this.build = {
      colliders:
        built.boxes +
        built.spheres +
        built.capsules +
        built.hulls +
        built.meshTriangles +
        built.heightfields,
      triangles: built.meshTriangles + 2 * built.heightfieldCells,
      seconds: (performance.now() - began) / 1000,
      bytes: built.bytes,
      parts,
    };
    const flagged = Object.entries(loaded.flagged)
      .filter(([, n]) => n > 0)
      .map(([name, n]) => `${name} ${n}`)
      .join(', ');
    this.collisionValues = [
      {
        name: 'Collision',
        value: `${collisionFile}: ${parts}`,
        source: 'data',
        note: `the game's collision export; ${built.boxes} boxes, ${built.spheres} spheres, ${built.hulls} hulls, ${built.meshTriangles} mesh triangles, ${built.heightfields} heightfields; flags: ${flagged || 'none'}`,
      },
    ];
    if (selection.lighting && options.lighting === null)
      this.collisionValues.push({
        name: 'Lighting variant',
        value: selection.lighting,
        source: 'assumed',
        note: 'the game picks one per match (a launch option); default the heaviest weight, lighting= picks another',
      });

    const spawn = this.startPoint(world);
    this.session = new MovementSession({
      collision: world,
      movementTypes,
      characterModules,
      modules,
      abilities,
      fuel: parseFuelResource(characters),
      chassisId: PROTOTYPE_CHASSIS,
      level: options.level,
      tierOverride: options.tierOverride,
      capsule: options.capsule,
      stepSeconds: options.hz === null ? null : 1 / options.hz,
      spawn,
      params: engine.params,
      killZ: engine.killZ,
      values: [
        ...optionValues(options),
        ...engine.values,
        ...this.collisionValues,
      ],
    });
    warnUnestablished(this.session.values(), this.session.unapplied());
    console.warn(
      '[movement] rules known gaps:\n' +
        RULES_KNOWN_GAPS.map((gap) => `  ${gap}`).join('\n') +
        '\n[movement] Jump Jet, dash and fuel known gaps:\n' +
        ABILITY_KNOWN_GAPS.map((gap) => `  ${gap}`).join('\n') +
        '\n[movement] engine known gaps:\n' +
        ENGINE_KNOWN_GAPS.map((gap) => `  ${gap}`).join('\n') +
        '\n[movement] collision known gaps:\n' +
        COLLISION_KNOWN_GAPS.map((gap) => `  ${gap}`).join('\n')
    );
    this.capsuleMesh.group.visible = true;
    this.lastFrame = null;
  }

  /** Where the capsule's centre starts (movement/start_point.ts); the
   * playable-box fallback is labelled in the details list. */
  private startPoint(world: ExactCollisionWorld): Vec3 {
    const { spawn, playableBox, options } = this.start;
    const start = startPoint(
      world,
      spawn,
      playableBox,
      options.capsule.halfHeight
    );
    if (start.standIn) {
      const { x, y, z } = start.location;
      this.collisionValues.push({
        name: 'Start point',
        value: `(${Math.round(x)}, ${Math.round(y)}, ${Math.round(z - options.capsule.halfHeight)})`,
        source: 'placeholder',
        note: 'no spawn pin in this map mode: the playable box centre, dropped onto the collision',
      });
    }
    return start.location;
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
        : { ...view, forward: 0, right: 0, jump: false, dash: false };
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
        jump: false,
        dash: false,
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
    this.session = null;
    delete window.__wrfDrive;
  }
}
