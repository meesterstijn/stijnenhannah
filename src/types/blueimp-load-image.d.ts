// Minimal type declarations for blueimp-load-image v5.
// Only the subset used in optimizeGrowthPhoto.ts is typed here.

declare module "blueimp-load-image" {
  interface LoadImageOptions {
    canvas?: boolean;
    meta?: boolean;
    /** true = apply EXIF orientation automatically */
    orientation?: boolean | number;
    maxWidth?: number;
    maxHeight?: number;
    imageSmoothingEnabled?: boolean;
    imageSmoothingQuality?: ImageSmoothingQuality;
  }

  interface LoadImageResult {
    /** The processed canvas (when canvas:true) or HTMLImageElement */
    image: HTMLCanvasElement | HTMLImageElement;
    originalWidth?: number;
    originalHeight?: number;
    exif?: { get(tag: string): unknown };
    imageHead?: ArrayBuffer;
  }

  function loadImage(
    file: File | Blob | string,
    options: LoadImageOptions & { canvas: true; meta: true },
  ): Promise<LoadImageResult>;

  function loadImage(
    file: File | Blob | string,
    options?: LoadImageOptions,
  ): Promise<LoadImageResult>;

  export default loadImage;
}
