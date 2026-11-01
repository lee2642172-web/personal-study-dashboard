import type { Material } from "./model.ts";
import { isEeaMaterial } from "./catalogs/eea.ts";

export const isBasicStudyBook = (m: Material) =>
  m.id === "basic" && m.area === "english" && m.kind === "units";

/** Input defaults only. Existing logs and their measured times are never changed. */
export function defaultStudyMinutes(m: Material): number | null {
  return isBasicStudyBook(m) ? 20 : isEeaMaterial(m) ? 30 : null;
}
