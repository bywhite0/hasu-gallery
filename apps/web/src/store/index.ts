import { create } from "zustand";

// Gallery state
interface AppState {
  currentGallery: "meme" | "art";
  setGallery: (gallery: "meme" | "art") => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentGallery: "meme",
  setGallery: (gallery) => set({ currentGallery: gallery }),
}));

// Re-export auth store
export { useAuthStore } from './auth';
