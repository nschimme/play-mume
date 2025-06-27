// Custom type definitions for split.js
// This is a basic placeholder to resolve module not found errors.
// For full type safety, install @types/split.js if available,
// or expand these definitions based on the library's API.

declare module 'split.js' {
  interface Options {
    sizes?: number[];
    minSize?: number | number[];
    maxSize?: number | number[];
    expandToMin?: boolean;
    gutterSize?: number;
    gutterAlign?: 'start' | 'center' | 'end';
    snapOffset?: number;
    dragInterval?: number;
    direction?: 'horizontal' | 'vertical';
    cursor?: string;
    gutter?: (index: number, direction: 'horizontal' | 'vertical') => HTMLElement;
    elementStyle?: (dimension: 'width' | 'height', size: number, gutterSize: number, index: number) => any;
    gutterStyle?: (dimension: 'width' | 'height', gutterSize: number, index: number) => any;
    onDrag?: (sizes: number[]) => void;
    onDragStart?: (sizes: number[]) => void;
    onDragEnd?: (sizes: number[]) => void;
  }

  interface Instance {
    setSizes(sizes: number[]): void;
    getSizes(): number[];
    collapse(index: number): void;
    destroy(preserveStyles?: boolean, preserveGutters?: boolean): void;
  }

  export default function Split(
    elements: (string | HTMLElement)[],
    options?: Options
  ): Instance;
}
