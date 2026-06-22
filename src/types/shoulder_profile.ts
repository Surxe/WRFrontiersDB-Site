/**
 * Types for Analysis/shoulder_profiles.json
 */

/** Pre-computed stats for a single shoulder at a given level. */
export interface ShoulderLevelStats {
  Armor: number;
  ShieldAmount: number;
  ShieldDelayReduction: number;
  ShieldRegeneration: number;
  RechargeDelay: number;
  RechargeTime: number;
  DelayAndRechargeTotal: number;
}

/** A single shoulder module with per-level stats. */
export interface ShoulderEntry {
  shoulder_module_ref: string;
  /** Keys are 1-indexed level numbers as strings ("1" through "13"). */
  levels: Record<string, ShoulderLevelStats>;
}

/**
 * A shoulder category: all shoulders sharing the same slot configuration
 * and weight drain.
 */
export interface ShoulderCategory {
  weight_drain: number;
  light_slots: number;
  heavy_slots: number;
  shoulders: ShoulderEntry[];
}
