// Custom type definitions for pixi.js
// This is a basic placeholder to resolve module not found errors (TS2792).
// For full type safety, install @types/pixi.js if available from npm,
// or expand these definitions based on the library's extensive API.

declare module 'pixi.js' {
  // Add minimal exports used by mume.mapper.ts to make it compile.
  // This will need to be significantly expanded for real type safety.

  // Based on usage like: PIXI.Application, PIXI.Assets, PIXI.Container, etc.
  // It seems PIXI might export a namespace-like object.

  // A very basic 'any' type for now to make it compile.
  // Replace with actual PIXI types if possible.
  const PIXI: any;
  export = PIXI;

  // Alternatively, if it's more like named exports:
  // export class Application { constructor(options?: any); stage: Container; renderer: any; view: HTMLCanvasElement; static shared: any; static ticker: any; render(): void; }
  // export class Container { addChild(child: any): any; removeChild(child: any): any; position: Point; scale: Point; pivot: Point; visible: boolean; alpha: number; filters: any[]; children: any[]; getLocalBounds(): any; getGlobalPosition(): Point; updateCacheTexture(): void; }
  // export class Sprite { constructor(texture?: any); static from(source: any): Sprite; width: number; height: number; scale: Point; }
  // export class Graphics {ลูกเต๋า lineStyle(width?: number, color?: number, alpha?: number): this; beginFill(color?: number, alpha?: number): this; drawRect(x: number, y: number, width: number, height: number): this; drawCircle(x: number, y: number, radius: number): this; moveTo(x: number, y: number): this; lineTo(x: number, y: number): this; endFill(): this; clear(): this; }
  // export class Text { constructor(text?: string, style?: any, canvas?: HTMLCanvasElement); style: any; pivot: Point; x: number; y: number; visible: boolean; }
  // export class Point { constructor(x?: number, y?: number); x: number; y: number; }
  // export class ColorMatrixFilter { brightness(b: number, multiply: boolean): void; }
  // export enum RendererType { UNKNOWN = 0, WEBGL = 1, CANVAS = 2 }
  // export const Assets: { load(assets: string | string[]): Promise<any>; get(alias: string): any; };

  // If PIXI is a namespace module, it might be more like:
  // export namespace PIXI {
  //   export class Application { constructor(options?: any); stage: Container; renderer: any; view: HTMLCanvasElement; static shared: any; static ticker: any; render(): void; init(options?: any): Promise<void>; }
  //   export class Container { addChild(child: any): any; removeChild(child: any): any; position: Point; scale: Point; pivot: Point; visible: boolean; alpha: number; filters: any[]; children: any[]; getLocalBounds(): any; getGlobalPosition(): Point; updateCacheTexture(): void; }
  //   export class Sprite { constructor(texture?: any); static from(source: any): Sprite; width: number; height: number; scale: Point; }
  //   export class Graphics { lineStyle(width?: number, color?: number, alpha?: number): this; beginFill(color?: number, alpha?: number): this; drawRect(x: number, y: number, width: number, height: number): this; drawCircle(x: number, y: number, radius: number): this; moveTo(x: number, y: number): this; lineTo(x: number, y: number): this; endFill(): this; clear(): this; stroke(options?: any): this; fill(options?: any): this; setStrokeStyle(options: any): this; }
  //   export class Text { constructor(options?: { text?: string, style?: any }); style: any; pivot: Point; x: number; y: number; visible: boolean; getLocalBounds(): any; }
  //   export class Point { constructor(x?: number, y?: number); x: number; y: number; }
  //   export class ColorMatrixFilter { brightness(b: number, multiply: boolean): void; }
  //   export enum RendererType { UNKNOWN = 0, WEBGL = 1, CANVAS = 2 }
  //   export const Assets: { load(assets: string | string[] | any[]): Promise<any>; get(alias: string): any; };
  // }
}
