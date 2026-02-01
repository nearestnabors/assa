/**
 * Avatar component with image and fallback initials
 */

import { useState } from "react";
import { getInitials } from "@/hooks/utils";

interface AvatarProps {
  /** Image URL */
  src?: string;
  /** Display name for fallback initials */
  name: string;
  /** Size in pixels (default: 44) */
  size?: number;
  /** Additional class names */
  className?: string;
}

export function Avatar({ src, name, size = 44, className = "" }: AvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const showFallback = !src || imageError;
  const initials = getInitials(name);

  return (
    <div
      className={`avatar ${className}`}
      style={{ width: size, height: size }}
    >
      {!showFallback && (
        // biome-ignore lint/a11y/noNoninteractiveElementInteractions: onLoad/onError are for image loading state, not user interaction
        <img
          alt={name}
          height={size}
          onError={() => setImageError(true)}
          onLoad={() => setImageLoaded(true)}
          src={src}
          style={{ display: imageLoaded ? "block" : "none" }}
          width={size}
        />
      )}
      {(showFallback || !imageLoaded) && (
        <div className="avatar-placeholder">{initials}</div>
      )}
    </div>
  );
}
