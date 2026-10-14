/**
 * The pins of a game mode: one marker per gameplay object, drawn in Unreal
 * space (centimeters, Z up) on top of the map, plus labels for what a shape
 * can't say (a beacon's or probe's order, what a power-up spawner spawns).
 *
 * `describePins` is the pure half (data -> marker specs); `PinLayer` draws
 * them with three.js and AnchoredTags.
 *
 * Every marker stands on a pole tall enough to be found from across a map (a
 * robot is 8 to 15 m tall); a ring on the ground is a zone at its true radius
 * (a beacon's or probe's capture zone, the drill's damage zone).
 */
import * as THREE from 'three';
import { AnchoredTags, type ScreenPoint } from '../viewer3d/anchored_tags';
import { cssHex } from '../viewer3d/colors';
import { clearGroup, MaterialCache } from '../viewer3d/materials';
import { toUeSpace } from '../viewer3d/stage';
import { PIN_COLORS, teamColor } from './colors';
import type { Pin, PinType, Vec3 } from '../../types/map';

/** What the page knows about a power-up (`Objects/Powerup.json`). */
export interface PowerupInfo {
  icon_path?: string;
  icon_color?: { Hex?: string };
}

export interface PowerupLabel {
  id: string;
  name: string;
  /** Data-repo texture path (no extension), as Icon.astro takes it. */
  iconPath?: string;
}

/** A marker to draw. */
export interface PinMarker {
  type: PinType;
  position: Vec3;
  yaw: number;
  color: number;
  zoneRadius?: number;
  /** Beacon / warp probe order, shown on its label. */
  order?: number;
  /** A spawner's power-ups, shown on its label. */
  powerups?: PowerupLabel[];
}

/** `BP_PowerUp_TeamRegenArmor` -> `Team Regen Armor`: power-ups have no name
 * of their own in the data. */
export function powerupName(id: string): string {
  return id
    .replace(/^BP_PowerUp_/, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .trim();
}

function hexColor(hex: string | undefined): number | null {
  return hex && /^[0-9a-f]{6}/i.test(hex)
    ? parseInt(hex.slice(0, 6), 16)
    : null;
}

/** The markers of a mode's pins. A spawner takes its first power-up's
 * minimap color. */
export function describePins(
  pins: readonly Pin[],
  powerups: Readonly<Record<string, PowerupInfo>>
): PinMarker[] {
  return pins.map((pin) => {
    const marker: PinMarker = {
      type: pin.type,
      position: pin.position,
      yaw: pin.yaw,
      color: PIN_COLORS[pin.type] ?? teamColor(pin.team),
    };
    if (pin.zone_radius !== undefined) marker.zoneRadius = pin.zone_radius;
    if (pin.order !== undefined) marker.order = pin.order;
    if (pin.type === 'powerup_spawner') {
      const ids = pin.powerup_ids ?? [];
      marker.powerups = ids.map((id) => ({
        id,
        name: powerupName(id),
        ...(powerups[id]?.icon_path && { iconPath: powerups[id].icon_path }),
      }));
      const first = ids.length > 0 ? powerups[ids[0]] : undefined;
      marker.color = hexColor(first?.icon_color?.Hex) ?? marker.color;
    }
    return marker;
  });
}

/** The first team's first spawn point, where the camera starts. */
export function firstSpawn(pins: readonly Pin[]): Pin | null {
  return (
    pins.find(({ type, team }) => type === 'spawn' && team === 0) ??
    pins.find(({ type }) => type === 'spawn') ??
    null
  );
}

// ---------------------------------------------------------------- drawing

const POLE_HEIGHT = 2500;
const POLE_RADIUS = 40;
const RING_WIDTH = 120;
/** Upload zones have no radius in the data (their trigger is tiny). */
const UPLOAD_ZONE_RADIUS = 1000;
/** Power-up labels show within this distance (cm): a mode can have a dozen
 * spawners, whose labels would pile up seen from across the map. Order labels
 * (beacons, probes) always show. */
const POWERUP_LABEL_RANGE = 20_000;

/** Geometry along Unreal's Z (three's primitives stand along Y). */
const upright = (geometry: THREE.BufferGeometry): THREE.BufferGeometry =>
  geometry.rotateX(Math.PI / 2);

function headGeometry(marker: PinMarker): THREE.BufferGeometry {
  switch (marker.type) {
    case 'spawn':
      // An arrow lying level, pointing the way a robot faces.
      return new THREE.ConeGeometry(220, 700, 4)
        .rotateZ(-Math.PI / 2)
        .rotateZ(THREE.MathUtils.degToRad(marker.yaw));
    case 'warp_probe':
      return new THREE.OctahedronGeometry(320);
    case 'beacon':
      return upright(new THREE.CylinderGeometry(300, 300, 360, 16));
    case 'powerup_spawner':
      return new THREE.BoxGeometry(320, 320, 320);
    case 'ctf_core':
      return new THREE.OctahedronGeometry(450);
    case 'ctf_upload_zone':
      return upright(new THREE.CylinderGeometry(380, 380, 120, 24));
    case 'drill':
      return upright(new THREE.ConeGeometry(380, 700, 12).rotateX(Math.PI));
  }
}

/** A label's text: a beacon's or probe's order, a spawner's power-ups. */
export interface PinLabelText {
  beacon: (order: number) => string;
  probe: (order: number) => string;
}

function labelCard(marker: PinMarker, text: PinLabelText): HTMLElement | null {
  let content: (Node | string)[] | null = null;
  if (marker.order !== undefined && marker.type === 'beacon') {
    content = [text.beacon(marker.order)];
  } else if (marker.order !== undefined && marker.type === 'warp_probe') {
    content = [text.probe(marker.order)];
  } else if (marker.powerups && marker.powerups.length > 0) {
    content = marker.powerups.map(({ name, iconPath }) => {
      const row = document.createElement('span');
      row.className = 'map-pin-powerup';
      if (iconPath) {
        const icon = document.createElement('img');
        icon.src = `/WRFrontiersDB-Data/textures${iconPath}.png`;
        icon.alt = '';
        icon.width = 18;
        icon.height = 18;
        row.append(icon);
      }
      row.append(name);
      return row;
    });
  }
  if (!content) return null;
  const card = document.createElement('div');
  card.className = 'map-pin-tag';
  card.style.borderColor = cssHex(marker.color);
  card.append(...content);
  return card;
}

/** A mode's markers in the scene, and their labels over the canvas. */
export class PinLayer {
  /** In Unreal space; add it to the scene. */
  readonly group = new THREE.Group();
  private readonly tags: AnchoredTags;
  /** Each label's anchor, in world space, and how far away it still shows. */
  private anchors: { point: THREE.Vector3; range: number }[] = [];

  constructor(container: HTMLElement) {
    toUeSpace(this.group);
    this.tags = new AnchoredTags(container, 'map-pin-tags');
    this.tags.visible = true;
  }

  /** Replace the drawn markers. */
  set(markers: readonly PinMarker[], text: PinLabelText): void {
    clearGroup(this.group);
    const solid = new MaterialCache(
      (color) => new THREE.MeshBasicMaterial({ color })
    );
    const zone = new MaterialCache(
      (color) =>
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
    );
    const cards: HTMLElement[] = [];
    const anchors: { point: THREE.Vector3; range: number }[] = [];
    for (const marker of markers) {
      const [x, y, z] = marker.position;
      const top = z + POLE_HEIGHT;
      const material = solid.get(marker.color);
      const pole = new THREE.Mesh(
        upright(
          new THREE.CylinderGeometry(POLE_RADIUS, POLE_RADIUS, POLE_HEIGHT, 6)
        ),
        material
      );
      pole.position.set(x, y, z + POLE_HEIGHT / 2);
      const head = new THREE.Mesh(headGeometry(marker), material);
      head.position.set(x, y, top);
      this.group.add(pole, head);

      const radius =
        marker.zoneRadius ??
        (marker.type === 'ctf_upload_zone' ? UPLOAD_ZONE_RADIUS : undefined);
      if (radius) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(Math.max(0, radius - RING_WIDTH), radius, 64),
          zone.get(marker.color)
        );
        ring.position.set(x, y, z + 40);
        this.group.add(ring);
      }

      const card = labelCard(marker, text);
      if (card) {
        cards.push(card);
        anchors.push({
          point: new THREE.Vector3(x, y, top + 500),
          range: marker.powerups ? POWERUP_LABEL_RANGE : Infinity,
        });
      }
    }
    this.tags.setCards(cards);
    this.group.updateMatrixWorld(true);
    this.anchors = anchors.map(({ point, range }) => ({
      point: this.group.localToWorld(point),
      range,
    }));
  }

  set visible(on: boolean) {
    this.group.visible = on;
    this.tags.visible = on;
  }

  /** Move the labels to their anchors' canvas positions, hiding those out
   * of range of `eye`. */
  layout(
    project: (anchor: THREE.Vector3) => ScreenPoint,
    eye: THREE.Vector3
  ): void {
    this.tags.layout(
      this.anchors.map(({ point, range }) =>
        point.distanceTo(eye) <= range ? project(point) : null
      )
    );
  }
}
