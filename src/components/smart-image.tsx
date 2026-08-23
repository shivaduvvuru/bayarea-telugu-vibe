import { useEffect, useState, type ImgHTMLAttributes } from "react";

import { cdnImage, cdnSrcSet } from "../lib/img";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet"> & {
  src: string;
  /** Rendered width hint used for the default (fallback) variant. */
  optimizedWidth?: number;
  quality?: number;
};

/**
 * Serves resized WebP variants of remote photos and silently falls back to the
 * original URL if the optimiser cannot fetch it.
 */
export function SmartImage({ src, optimizedWidth = 960, quality = 72, ...rest }: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) {
    return <img {...rest} src={src} />;
  }

  return (
    <img
      {...rest}
      src={cdnImage(src, optimizedWidth, quality)}
      srcSet={cdnSrcSet(src, quality)}
      onError={(event) => {
        setFailed(true);
        rest.onError?.(event);
      }}
    />
  );
}
