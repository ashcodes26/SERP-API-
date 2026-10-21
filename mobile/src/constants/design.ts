import { palette as p } from './palette';
import tokens from './design-tokens.json';
import { Platform, type TextStyle } from 'react-native';

/** Dark Void: electric iris actions, restrained saffron highlights. */
export const design = {
  canvas: p.void, surface: p.carbon, elevated: p.obsidian,
  border: p.graphite, strongBorder: p.smoke, text: p.paper,
  body: p.mist, muted: p.fog, accent: p['electric-iris'], highlight: p.saffron, success: p.verdant,
  error: p['coral-red'], higher: p.higher, overlay: p.overlay, scrim: p.scrim,
  disabled: p.disabled, accentHover: p['accent-hover'], accentPressed: p['accent-pressed'],
  successText: p['success-text'], info: p.info, replacement: p.replacement,
  radius: tokens.radii.pill, controlRadius: tokens.radii.pill,
} as const;

export const { spacing, radii, sizes, breakpoints, layout } = tokens;
// Inter is preferred on web when available; no remote font dependency is required.
export const sans = Platform.select({ web: 'var(--font-display)', ios: 'System', default: 'sans-serif' });
export const typography = Object.fromEntries(Object.entries(tokens.typography).map(([key, value]) => [key, { ...value, fontFamily: sans }])) as Record<keyof typeof tokens.typography, TextStyle>;
