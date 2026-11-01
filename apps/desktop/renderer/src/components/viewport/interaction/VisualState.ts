import type { SpatialObject } from '../../../types';

/** Bindings belong to one scene instance and are discarded before its resources. */
export type VisualStateUpdate = (selected: boolean, debugActive: boolean, state?: SpatialObject) => void;
export type RegisterVisualState = (update: VisualStateUpdate) => void;
