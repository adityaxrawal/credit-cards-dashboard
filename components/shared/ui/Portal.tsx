"use client";

import React from "react";
import { createPortal } from "react-dom";

interface PortalProps {
  children: React.ReactNode;
  containerId?: string;
}

export default function Portal({ children, containerId = "portal-root" }: PortalProps) {
  const [container, setContainer] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    const el = document.getElementById(containerId);
    setContainer(el || document.body);
  }, [containerId]);

  if (!container) return null;
  return createPortal(children, container);
}