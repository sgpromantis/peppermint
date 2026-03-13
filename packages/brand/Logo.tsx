import React from "react";
import { logo, identity } from "./index";

interface BrandLogoProps {
  /** Height of the logo in pixels (default 36) */
  height?: number;
  /** Override the className on the wrapper div */
  className?: string;
}

export function BrandLogo({
  height = 36,
  className = "",
}: BrandLogoProps) {
  return (
    <div className={`flex items-center select-none ${className}`}>
      <img
        src={logo.src}
        alt={logo.alt}
        height={height}
        style={{ height, width: "auto" }}
        draggable={false}
      />
    </div>
  );
}
