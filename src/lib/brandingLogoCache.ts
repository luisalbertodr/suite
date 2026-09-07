const LIGHT_KEY = 'suite_branding_logo_light';
const DARK_KEY = 'suite_branding_logo_dark';

export function cacheBrandingLogos(logoUrlLight: string | null | undefined, logoUrlDark: string | null | undefined) {
  try {
    if (logoUrlLight) localStorage.setItem(LIGHT_KEY, logoUrlLight);
    if (logoUrlDark) localStorage.setItem(DARK_KEY, logoUrlDark);
  } catch {
    // ignore quota / private mode
  }
}

export function getCachedBrandingLogo(variant: 'light' | 'dark'): string | null {
  try {
    const value = localStorage.getItem(variant === 'dark' ? DARK_KEY : LIGHT_KEY);
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}
