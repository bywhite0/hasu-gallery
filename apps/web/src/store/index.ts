import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from "../i18n/locales";

export type ArtRatingPreference = "all_ages" | "r15" | "r18";

// Gallery state
interface AppState {
  currentGallery: "meme" | "art";
  setGallery: (gallery: "meme" | "art") => void;
  artRatingPreference: ArtRatingPreference;
  setArtRatingPreference: (rating: ArtRatingPreference) => void;
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentGallery: "meme",
      setGallery: (gallery) => set({ currentGallery: gallery }),
      artRatingPreference: "all_ages",
      setArtRatingPreference: (rating) => set({ artRatingPreference: rating }),
      locale: DEFAULT_LOCALE,
      setLocale: (locale) => set({ locale: isSupportedLocale(locale) ? locale : DEFAULT_LOCALE }),
    }),
    {
      name: "hasu-gallery-preferences",
      partialize: (state) => ({
        artRatingPreference: state.artRatingPreference,
        locale: state.locale,
      }),
    },
  ),
);

// Re-export auth store
export { useAuthStore } from './auth';
