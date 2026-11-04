export type ParamValue = number | boolean | string;
export type Params = Record<string, any>;

export interface RangeParam {
  type?: 'range';
  key: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  default: number;
  /** Changing this param rebuilds the simulation. */
  reset?: boolean;
  /** Display formatter. */
  fmt?: (v: number) => string;
  hint?: string;
}
export interface SelectParam {
  type: 'select';
  key: string;
  label: string;
  options: { value: string; label: string }[];
  default: string;
  reset?: boolean;
  hint?: string;
}
export interface ToggleParam {
  type: 'toggle';
  key: string;
  label: string;
  default: boolean;
  reset?: boolean;
  hint?: string;
}
export interface ColorParam {
  type: 'color';
  key: string;
  label: string;
  default: string;
  reset?: boolean;
  hint?: string;
}
export type ParamDef = RangeParam | SelectParam | ToggleParam | ColorParam;

/** A heading inside the control list. */
export interface ParamGroup {
  type: 'group';
  label: string;
}

export interface PointerInfo {
  type: 'down' | 'move' | 'up';
  x: number;
  y: number;
  dx: number;
  dy: number;
  button: number;
  /** true while any button is held */
  down: boolean;
  shift: boolean;
  alt: boolean;
}

export interface SimContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** CSS pixel size of the drawing area. */
  width: number;
  height: number;
  params: Params;
  /** true when rendering a small gallery thumbnail */
  thumbnail: boolean;
}

export interface SimInstance {
  /** Advance one simulation tick. */
  step(): void;
  /** Render the current state. */
  draw(): void;
  pointer?(p: PointerInfo): void;
  wheel?(x: number, y: number, delta: number): void;
  /** Called when a param without `reset` changes. */
  paramChanged?(key: string): void;
  stats?(): [string, string | number][];
  actions?: { label: string; run: () => void }[];
  dispose?(): void;
}

export interface Preset {
  name: string;
  values: Params;
}

export type Category = 'Swarms & Life' | 'Cosmos & Mechanics' | 'Chaos' | 'Growth & Patterns' | 'Waves & Fluids' | 'Societies';

export interface SimDef {
  id: string;
  title: string;
  tagline: string;
  category: Category;
  /** accent color used on cards / controls */
  accent: string;
  params: (ParamDef | ParamGroup)[];
  presets?: Preset[];
  /** How to interact, shown under the canvas title. */
  controls?: string;
  /** Short explainer (HTML allowed). */
  about: string;
  /** Steps to pre-run when making the gallery thumbnail. */
  thumbSteps?: number;
  create(ctx: SimContext): SimInstance;
}
