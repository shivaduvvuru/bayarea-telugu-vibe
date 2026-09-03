import { useEffect, useState, type ImgHTMLAttributes } from "react";

import { cdnImage, cdnSrcSet } from "../lib/img";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet"> & {
  src: string;
  /** Local or remote image used after the optimized/original image fails. */
  fallbackSrc?: string;
  /** Rendered width hint used for the default (fallback) variant. */
  optimizedWidth?: number;
  quality?: number;
};

/**
 * Serves resized WebP variants of remote photos and falls back to a supplied
 * editorial image when the remote artwork cannot be loaded.
 */
export function SmartImage({
  src,
  fallbackSrc = "/photo-fallback.svg",
  optimizedWidth = 960,
  quality = 72,
  ...rest
}: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <img
      {...rest}
      src={failed ? fallbackSrc : cdnImage(src, optimizedWidth, quality)}
      srcSet={failed ? undefined : cdnSrcSet(src, quality)}
      onError={(event) => {
        if (!failed) setFailed(true);
        rest.onError?.(event);
      }}
    />
  );
}
