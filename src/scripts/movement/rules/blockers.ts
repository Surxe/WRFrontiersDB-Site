/**
 * WRF's blocker sets on the movement component (findings step 1, reflected
 * members `AirControlBlockers` +0x1058, `WalkingModeBlockers` +0x10b8,
 * `MovementInputBlockers` +0x1118): an ability holds one while it runs and
 * the movement code asks only whether any holder is active ("blocker set is
 * active", `0x1441b4b90`). Nothing in plain driving holds one; the dash
 * (`bBlocksAirControl`, step 6) and other abilities do.
 */
export class Blockers {
  private readonly holders = new Set<string>();

  add(holder: string): void {
    this.holders.add(holder);
  }

  remove(holder: string): void {
    this.holders.delete(holder);
  }

  get active(): boolean {
    return this.holders.size > 0;
  }

  list(): string[] {
    return [...this.holders];
  }

  clear(): void {
    this.holders.clear();
  }
}
