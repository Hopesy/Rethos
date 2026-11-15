export type CloudColor = "blue" | "teal" | "purple" | "orange" | "red" | "yellow";
export type CloudSwatch = "blue" | "green" | "amber" | "rose" | "violet" | "slate";
export declare const CLOUD_SWATCHES: readonly CloudSwatch[];
export declare const CLOUD_SWATCH_COLORS: Readonly<Record<CloudSwatch, CloudColor | null>>;
export declare function swatchColor(swatch: unknown): CloudColor | null;
