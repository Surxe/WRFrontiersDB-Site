/**
 * Drive mode's debug overlay: plain text over the canvas (English only: a
 * developer readout for the prototype, not page UI). Styled from maps.astro
 * (`#map-canvas .drive-overlay`).
 */
import { size2D } from '../../movement/math/vec';
import { sourceLabel } from '../../movement/placeholders';
import type { FrameStats, MovementSession } from '../../movement/session';
import type { Summary } from './stats';
import type { BuildInfo } from './drive_mode';
import { COLLISION_KNOWN_GAPS } from '../../movement/collision/known_gaps';
import { ENGINE_KNOWN_GAPS } from '../../movement/engine/known_gaps';
import { RULES_KNOWN_GAPS } from '../../movement/rules/tuned_movement';
import { ABILITY_KNOWN_GAPS } from '../../movement/rules/abilities/known_gaps';
import type { RollingStats } from './stats';

const ms = (s: Summary, digits = 2): string =>
  `${s.mean.toFixed(digits)} mean / ${s.p95.toFixed(digits)} p95 / ${s.max.toFixed(digits)} max`;

/** A text fuel gauge, `width` cells; marks the jump cost. */
function fuelGauge(value: number, max: number, jumpCost: number): string {
  const width = 32;
  const filled = max > 0 ? Math.round((value / max) * width) : 0;
  const mark = max > 0 ? Math.round((jumpCost / max) * width) : -1;
  let bar = '';
  for (let i = 0; i < width; i++)
    bar += i < filled ? '#' : i === mark - 1 ? '|' : '.';
  return `[${bar}]`;
}

const v3 = (v: { x: number; y: number; z: number }): string =>
  `(${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`;

export class DriveOverlay {
  private readonly node: HTMLPreElement;
  /** Show where every value comes from (H); the console always lists them. */
  private details = false;

  constructor(container: HTMLElement) {
    this.node = document.createElement('pre');
    this.node.className = 'drive-overlay';
    container.append(this.node);
  }

  toggleDetails(): void {
    this.details = !this.details;
  }

  showStatus(text: string): void {
    this.node.classList.remove('is-error');
    this.node.textContent = `DRIVE MODE (prototype)\n${text}`;
  }

  showError(text: string): void {
    this.node.classList.add('is-error');
    this.node.textContent = `DRIVE MODE (prototype)\nFailed: ${text}`;
  }

  showStats(
    session: MovementSession,
    summary: ReturnType<RollingStats['summary']>,
    build: BuildInfo | null,
    last: FrameStats | null,
    locked: boolean
  ): void {
    const m = session.movement;
    const robot = session.robot;
    const floor = m.currentFloor;
    const fps = summary.frameMs.mean > 0 ? 1000 / summary.frameMs.mean : 0;
    const lines = [
      `DRIVE MODE (prototype): stock UE 5.4 walking/falling + exported tuning`,
      `${session.chassisId} (${session.chassisLevel.moduleId} level ${session.chassisLevel.level}) -> ${session.movementType.id}`,
      locked
        ? 'WASD move, Space jump (hold to fly), mouse look, 1-6 one tier / 0 game blend, T respawn, H details, Esc release'
        : 'Click "Fly" (or press F) to capture the mouse and drive',
      '',
      `Speed     ${Math.round(size2D(m.velocity))} cm/s ground, ${Math.round(m.velocity.z)} cm/s vertical`,
      `Mode      ${m.movementMode}`,
      `Fuel      ${fuelGauge(robot.fuel.value, robot.fuel.maxValue, session.jetpack.jumpFuelCost)} ${robot.fuel.value.toFixed(1)} / ${robot.fuel.maxValue}${robot.fuel.regenBlockers.active ? ' (no regen)' : ''}`,
      `Jump Jet  ${robot.jetpack.state}, gravity scale ${m.params.gravityScale}`,
      `Floor     ${floor.blockingHit ? `${v3(floor.hitResult.impactNormal)} ${floor.isWalkableFloor() ? 'walkable' : 'unwalkable'}, dist ${floor.getDistanceToFloor().toFixed(2)}` : 'none'}`,
      `Tiers     ${m.properties.describe()} of 0-${session.movementType.tiers.length - 1}`,
      '',
      `Frame     ${ms(summary.frameMs)} ms (${fps.toFixed(0)} fps)`,
      `Sim       ${ms(summary.simMs)} ms/frame, timestep ${session.describeTimestep()} (${last?.steps ?? 0} this frame)`,
      `Collision ${ms(summary.collisionMs, 3)} ms/frame, ${summary.queries.mean.toFixed(1)} queries/frame`,
      `          ${ms(summary.collisionMsPerStep, 3)} ms/step`,
    ];
    if (build) {
      lines.push(
        `Build     ${build.colliders.toLocaleString('en')} colliders, ${build.triangles.toLocaleString('en')} triangles, ${build.seconds.toFixed(2)} s, ${Math.round(build.bytes / 1e6)} MB`,
        `          ${build.parts}`
      );
    }
    if (!this.details) {
      const shaky = session
        .values()
        .filter((v) => v.source !== 'data' && v.source !== 'finding');
      lines.push(
        '',
        `${shaky.length} values not yet the game's, ${RULES_KNOWN_GAPS.length} rules, ${ABILITY_KNOWN_GAPS.length} Jump Jet and fuel, ${ENGINE_KNOWN_GAPS.length} engine and ${COLLISION_KNOWN_GAPS.length} collision gaps: H lists them (also in the console)`
      );
      this.node.classList.remove('is-error');
      this.node.textContent = lines.join('\n');
      return;
    }
    lines.push('', "Values (the game's only when DATA or FINDING):");
    for (const value of session.values()) {
      lines.push(
        `  ${sourceLabel(value.source).padEnd(11)} ${value.name}: ${value.value}  (${value.note})`
      );
    }
    lines.push('', 'Rules known gaps:');
    for (const gap of RULES_KNOWN_GAPS) lines.push(`  ${gap}`);
    lines.push('', 'Jump Jet and fuel known gaps:');
    for (const gap of ABILITY_KNOWN_GAPS) lines.push(`  ${gap}`);
    lines.push('', 'Engine known gaps:');
    for (const gap of ENGINE_KNOWN_GAPS) lines.push(`  ${gap}`);
    lines.push('', 'Collision known gaps:');
    for (const gap of COLLISION_KNOWN_GAPS) lines.push(`  ${gap}`);
    lines.push(
      '',
      'Loaded, not applied: ' +
        session
          .unapplied()
          .map((f) => f.name)
          .join('; ')
    );
    this.node.classList.remove('is-error');
    this.node.textContent = lines.join('\n');
  }

  dispose(): void {
    this.node.remove();
  }
}
