import { create } from "zustand";

interface AppState {
  currentGallery: "meme" | "art";
  setGallery: (gallery: "meme" | "art") => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentGallery: "meme",
  setGallery: (gallery) => set({ currentGallery: gallery }),
}));
