"use client";

import type { ReactNode } from "react";

type Props = {
  variant?: "empty" | "loading" | "error";
  children: ReactNode;
};

export function Marginalia({ variant = "empty", children }: Props) {
  return <p className={`marginalia ${variant}`}>{children}</p>;
}
