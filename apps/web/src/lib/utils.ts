import { twMerge } from "tailwind-merge"

type ClassValue = string | undefined | null | false | ClassValue[]

function clsx(...inputs: ClassValue[]): string {
  return inputs.flat(Infinity as 1).filter(Boolean).join(' ')
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(...inputs))
}
