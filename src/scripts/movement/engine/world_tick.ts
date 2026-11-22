/**
 * The frame time the world hands to movement, ported from UE 5.4.4:
 * `UWorld::Tick(float DeltaSeconds)` passes it through
 * `AWorldSettings::FixupDeltaSeconds` (WorldSettings.cpp:279), which clamps
 * it to [MinUndilatedFrameTime, MaxUndilatedFrameTime] x time dilation (1)
 * in float, before UCharacterMovementComponent::TickComponent splits it
 * into sub-steps. A 0.5 s hitch moves the robot by 0.4 s (09-editor.md 2.6).
 */
import { f32 } from '../math/vec';
import {
  MAX_UNDILATED_FRAME_TIME,
  MIN_UNDILATED_FRAME_TIME,
} from './constants';

const MIN_FRAME = f32(MIN_UNDILATED_FRAME_TIME);
const MAX_FRAME = f32(MAX_UNDILATED_FRAME_TIME);

/** AWorldSettings::FixupDeltaSeconds with time dilation 1, in float. */
export function fixupDeltaSeconds(frameSeconds: number): number {
  return Math.min(Math.max(f32(frameSeconds), MIN_FRAME), MAX_FRAME);
}
