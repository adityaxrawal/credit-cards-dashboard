import React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps {
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
  animation?: "pulse" | "wave";
  className?: string;
}

export function Skeleton({
  variant = "text",
  width,
  height,
  animation = "pulse",
  className,
}: SkeletonProps) {
  const variantStyles = {
    text: "rounded",
    circular: "rounded-full",
    rectangular: "rounded-lg",
  };

  const animationStyles = {
    pulse: "animate-pulse",
    wave: "animate-pulse", // Could be enhanced with a wave animation
  };

  const style = React.useMemo(() => {
    const styleObj: React.CSSProperties = {};

    if (width !== undefined) {
      styleObj.width = typeof width === "number" ? `${width}px` : width;
    }

    if (height !== undefined) {
      styleObj.height = typeof height === "number" ? `${height}px` : height;
    }

    return styleObj;
  }, [width, height]);

  return (
    <div
      className={cn(
        "bg-hover-bg",
        variantStyles[variant],
        animationStyles[animation],
        variant === "text" && !height && "h-4",
        variant === "circular" && !width && !height && "w-10 h-10",
        variant === "rectangular" && !height && "h-20",
        className
      )}
      style={style}
    />
  );
}
