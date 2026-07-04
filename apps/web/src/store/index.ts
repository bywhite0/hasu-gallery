import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ArtRatingPreference = "all_ages" | "r15" | "r18";

// Gallery state
interface AppState {
  currentGallery: "meme" | "art";
  setGallery: (gallery: "meme" | "art") => void;
  artRatingPreference: ArtRatingPreference;
  setArtRatingPreference: (rating: ArtRatingPreference) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentGallery: "meme",
      setGallery: (gallery) => set({ currentGallery: gallery }),
      artRatingPreference: "all_ages",
      setArtRatingPreference: (rating) => set({ artRatingPreference: rating }),
    }),
    {
      name: "hasu-gallery-preferences",
      partialize: (state) => ({
        artRatingPreference: state.artRatingPreference,
      }),
    },
  ),
);

// Re-export auth store
export { useAuthStore } from './auth';
