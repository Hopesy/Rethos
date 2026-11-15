export type CloudColor = "blue" | "teal" | "purple" | "orange" | "red" | "yellow";
export declare const CLOUD_COLORS: readonly CloudColor[];
export declare const DEFAULT_CLOUD_COLOR: CloudColor;
export declare const CLOUD_NAME_MAX: number;
export declare const CLOUD_COLOR_HEX: Readonly<Record<CloudColor, string>>;
export declare function cleanCloudName(value: unknown): string | null;
export declare function cleanCloudColor(value: unknown): CloudColor | null;
export declare function colorDotPng(hex: string, size: number, diameter?: number): string;
export declare function colorDotIcons<T extends { addRepresentation(options: { scaleFactor: number; dataURL: string }): void; isEmpty(): boolean }>(nativeImage: { createEmpty(): T }): (color: unknown) => T | null;

export { CLOUD_SWATCH_COLORS, CLOUD_SWATCHES, swatchColor, type CloudSwatch } from "../shared/place-colors.mjs";
