import type { CloudSwatch } from "../../shared/place-colors.mjs";
import { CLOUD_SWATCH_COLORS } from "../../shared/place-colors.mjs";
import type { LocaleKey } from "@/locales";
import { cloudColorFill } from "@/lib/cloud-look";

/** A Cloud's name as the Admin keeps it: up to 40 characters. */
export const CLOUD_LIST_NAME_LIMIT = 40;
/** The colour each Admin swatch is drawn in here (electron/cloud-list.mjs CLOUD_SWATCH_COLORS); slate is the plain one. */
export const SWATCH_COLOR = CLOUD_SWATCH_COLORS;
export function swatchFill(swatch: CloudSwatch): string {
  const color = SWATCH_COLOR[swatch];
  return color ? cloudColorFill(color) : "var(--color-raised)";
}

/** The Admin's swatches in the order the sheet offers them, each with the name of the colour this app draws it in. */
export const CLOUD_SWATCH_LABEL = {
  blue: "cloudBuy.color.blue", green: "cloudBuy.color.teal", amber: "cloudBuy.color.yellow", rose: "cloudBuy.color.red", violet: "cloudBuy.color.purple", slate: "cloudBuy.color.slate",
} as const satisfies Record<CloudSwatch, LocaleKey>;
export const CLOUD_SWATCH_ORDER = Object.keys(CLOUD_SWATCH_LABEL) as CloudSwatch[];
export const DEFAULT_SWATCH: CloudSwatch = "blue";
