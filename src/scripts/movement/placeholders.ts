/**
 * Where every value the simulation runs on comes from, so the overlay and
 * the console can say which ones are the game's and which aren't. Nothing
 * here may be presented as the game's behaviour unless its source is
 * 'data' or a reverse-engineering finding.
 */

export type ValueSource =
  /** Read from the exported data, with a meaning the field states. */
  | 'data'
  /** Established by reverse-engineering the game (findings/), e.g. a
   * constant in its code, or how it reads a data field. */
  | 'finding'
  /** Read from the exported data, but how the game uses it is assumed. */
  | 'assumed'
  /** Epic's UE 5.4 default; War Robots' own value is unknown. */
  | 'ue-default'
  /** A stand-in until a finding replaces it (prototype only). */
  | 'placeholder';

export interface ValueProvenance {
  name: string;
  value: string;
  source: ValueSource;
  /** Where it comes from, or what would replace it. */
  note: string;
}

/** Exported fields that are loaded but don't drive anything yet. */
export interface UnappliedField {
  name: string;
  why: string;
}

const LABELS: Readonly<Record<ValueSource, string>> = {
  data: 'DATA',
  finding: 'FINDING',
  assumed: 'ASSUMED',
  'ue-default': 'UE DEFAULT',
  placeholder: 'PLACEHOLDER',
};

export const sourceLabel = (source: ValueSource): string => LABELS[source];

/** Report the values that aren't established, once, in the console. */
export function warnUnestablished(
  values: readonly ValueProvenance[],
  unapplied: readonly UnappliedField[]
): void {
  const shaky = values.filter(
    ({ source }) => source !== 'data' && source !== 'finding'
  );
  if (shaky.length > 0) {
    console.warn(
      '[movement] values not established from the game:\n' +
        shaky
          .map(
            (v) => `  ${LABELS[v.source]}: ${v.name} = ${v.value} (${v.note})`
          )
          .join('\n')
    );
  }
  if (unapplied.length > 0) {
    console.warn(
      '[movement] exported fields loaded but not applied:\n' +
        unapplied.map((f) => `  ${f.name}: ${f.why}`).join('\n')
    );
  }
}
