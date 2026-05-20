"use client";

import { useState } from "react";

export default function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <button
      className="ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setFailed(true);
          setTimeout(() => setFailed(false), 1500);
        }
      }}
    >
      {copied ? "Copied to vault" : failed ? "Copy failed" : label}
    </button>
  );
}
