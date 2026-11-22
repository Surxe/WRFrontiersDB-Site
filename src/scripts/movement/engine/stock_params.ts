/**
 * UCharacterMovementComponent's tunable properties with their UE 5.4.4
 * defaults (the UCharacterMovementComponent constructor,
 * CharacterMovementComponent.cpp ~585-712, and UPhysicsSettingsCore for
 * gravity and terminal velocity). These are Epic's defaults, not War
 * Robots' values: the rules layer replaces what the game's data or code
 * establishes, and the overlay lists which ones are still stock.
 */

export interface StockParams {
  /** cm/s^2; UPhysicsSettingsCore::DefaultGravityZ times GravityScale (1). */
  gravityZ: number;
  /** cm/s; APhysicsVolume::TerminalVelocity (DefaultTerminalVelocity). */
  terminalVelocity: number;
  maxWalkSpeed: number;
  maxAcceleration: number;
  groundFriction: number;
  brakingFrictionFactor: number;
  brakingSubStepTime: number;
  brakingDecelerationWalking: number;
  brakingDecelerationFalling: number;
  useSeparateBrakingFriction: boolean;
  brakingFriction: number;
  airControl: number;
  airControlBoostMultiplier: number;
  airControlBoostVelocityThreshold: number;
  fallingLateralFriction: number;
  minAnalogWalkSpeed: number;
  maxStepHeight: number;
  /** cos(walkable floor angle); the constructor calls SetWalkableFloorZ(0.71). */
  walkableFloorZ: number;
  perchRadiusThreshold: number;
  perchAdditionalHeight: number;
  maxSimulationTimeStep: number;
  maxSimulationIterations: number;
  maxDepenetrationWithGeometry: number;
  maintainHorizontalGroundVelocity: boolean;
  canWalkOffLedges: boolean;
  alwaysCheckFloor: boolean;
}

export const UE_DEFAULTS: Readonly<StockParams> = {
  gravityZ: -980,
  terminalVelocity: 4000,
  maxWalkSpeed: 600,
  maxAcceleration: 2048,
  groundFriction: 8,
  brakingFrictionFactor: 2,
  brakingSubStepTime: 1 / 33,
  brakingDecelerationWalking: 2048,
  brakingDecelerationFalling: 0,
  useSeparateBrakingFriction: false,
  brakingFriction: 0,
  airControl: 0.05,
  airControlBoostMultiplier: 2,
  airControlBoostVelocityThreshold: 25,
  fallingLateralFriction: 0,
  minAnalogWalkSpeed: 0,
  maxStepHeight: 45,
  walkableFloorZ: 0.71,
  perchRadiusThreshold: 0,
  perchAdditionalHeight: 40,
  maxSimulationTimeStep: 0.05,
  maxSimulationIterations: 8,
  maxDepenetrationWithGeometry: 500,
  maintainHorizontalGroundVelocity: true,
  canWalkOffLedges: true,
  alwaysCheckFloor: true,
};
