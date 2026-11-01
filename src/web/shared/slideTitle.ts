import type { Slide } from "../../core/schema";

export const NAME_MAX = 80;

/** Auto title: the biggest text on the slide. */
export function autoTitle(s: Slide, i: number): string {
  const size = (e: Slide["elements"][number]) => Number(e.style.fontSize) || 0;
  const best = s.elements.filter((e) => e.type === "text" && e.text.trim()).sort((a, b) => size(b) - size(a))[0];
  if (best?.type === "text") return best.text.trim().split("\n").join(" ");
  return s.elements.length ? `Slide ${i + 1}` : "(kosong)";
}

/** Manual name wins; otherwise the auto title. `named` tells the UI which one it got. */
export function slideTitle(s: Slide, i: number): { title: string; named: boolean } {
  const name = s.name?.trim();
  return name ? { title: name, named: true } : { title: autoTitle(s, i), named: false };
}
