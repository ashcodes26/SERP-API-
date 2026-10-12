import { palette as p } from './palette';

/** Dark Void: electric iris actions, restrained saffron highlights. */
export const design = {
  canvas: p.void, surface: p.carbon, elevated: p.obsidian,
  border: p.graphite, strongBorder: p.smoke, text: p.paper,
  body: p.mist, muted: p.fog, accent: p['electric-iris'], highlight: p.saffron, success: p.verdant,
  error: p['coral-red'], radius: 24, controlRadius: 24,
} as const;
