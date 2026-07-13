import { useEffect } from 'react';
import { supabase, storeSettingsToRow } from '@/lib/supabase';
import { useStoreSettings } from '@/hooks/use-store-settings';

// Predefined theme color options with HSL values
export const THEME_COLORS = [
  { name: 'Biru', hue: '215', saturation: '100%', lightness: '50%' },
  { name: 'Oranye', hue: '25', saturation: '95%', lightness: '53%' },
  { name: 'Hijau', hue: '142', saturation: '71%', lightness: '45%' },
  { name: 'Ungu', hue: '262', saturation: '83%', lightness: '58%' },
  { name: 'Merah', hue: '0', saturation: '84%', lightness: '60%' },
  { name: 'Pink', hue: '330', saturation: '81%', lightness: '60%' },
  { name: 'Teal', hue: '172', saturation: '66%', lightness: '50%' },
  { name: 'Kuning', hue: '45', saturation: '93%', lightness: '47%' },
] as const;

export function getThemeHSL(hue: string) {
  const preset = THEME_COLORS.find(c => c.hue === hue);
  if (preset) return `${preset.hue} ${preset.saturation} ${preset.lightness}`;
  return `${hue} 95% 53%`;
}

export function applyThemeColor(hue: string) {
  const hsl = getThemeHSL(hue);
  document.documentElement.style.setProperty('--primary', hsl);
  document.documentElement.style.setProperty('--ring', hsl);
  // Update meta theme-color for PWA
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', `hsl(${hsl})`);
}

export function useThemeColor() {
  const { settings } = useStoreSettings();

  useEffect(() => {
    if (settings?.themeColor) {
      applyThemeColor(settings.themeColor);
    }
  }, [settings?.themeColor]);

  return settings?.themeColor ?? '215';
}

export async function setThemeColor(hue: string) {
  await supabase.from('store_settings').update(storeSettingsToRow({ themeColor: hue })).eq('id', 1);
  applyThemeColor(hue);
}
