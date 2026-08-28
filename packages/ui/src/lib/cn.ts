import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// twMerge makes a caller-supplied className deterministically override the
// primitive's base classes (clsx alone leaves both and stylesheet order wins).
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
