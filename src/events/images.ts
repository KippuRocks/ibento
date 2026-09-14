/** The image types an event document may use (`T-026-06`): raster formats with no active content. */
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type ImageType = (typeof IMAGE_TYPES)[number];

/** The largest image kippu-api accepts: 2 MiB. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export function isImageType(type: string): type is ImageType {
  return (IMAGE_TYPES as readonly string[]).includes(type);
}

/** Why a file cannot be uploaded as an event image; `null` when it can be. */
export function imageProblem(file: {
  readonly type: string;
  readonly size: number;
}): string | null {
  if (!isImageType(file.type)) {
    return "Choose a JPEG, PNG or WebP image.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "Choose an image of at most 2 MiB.";
  }
  if (file.size === 0) {
    return "The image is empty.";
  }
  return null;
}

/** A file's bytes in standard base64, as `metadata.images.upload` takes them. */
export function base64Of(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("the file could not be read"));
    reader.onload = () => {
      const url = String(reader.result);
      resolve(url.slice(url.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}
