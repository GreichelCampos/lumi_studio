import * as THREE from 'three';
import { resolveLumiColor } from '../../../services/spatial/SpatialVisualTheme';

export function surfaceMaterial(material?: string): { roughness: number; metalness: number } {
  const name = material?.toLowerCase() ?? '';
  if (/metal|acero|aluminio/.test(name)) return { roughness: 0.2, metalness: 0.8 };
  if (/madera|roble|nogal|parquet/.test(name)) return { roughness: 0.6, metalness: 0.05 };
  if (/vidrio|cristal/.test(name)) return { roughness: 0.1, metalness: 0 };
  return { roughness: 0.85, metalness: 0 };
}

export function surfaceColor(value: string | undefined, fallback: string): string {
  const clean = value?.trim().toLowerCase();
  if (clean && Object.hasOwn(THREE.Color.NAMES, clean)) return clean;
  if (clean && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(clean)) return clean;
  return resolveLumiColor(clean, fallback);
}
