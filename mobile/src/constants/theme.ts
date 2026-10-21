/** Expo theme compatibility exports backed by the shared Dark Void tokens. */

import '@/global.css';

import { Platform } from 'react-native';
import { design as d, spacing, layout } from './design';

export const Colors = {
  light: {
    text: d.text,
    background: d.canvas,
    backgroundElement: d.surface,
    backgroundSelected: d.elevated,
    textSecondary: d.muted,
  },
  dark: {
    text: d.text,
    background: d.canvas,
    backgroundElement: d.surface,
    backgroundSelected: d.elevated,
    textSecondary: d.muted,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = spacing;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = layout.workspace;
