import React from "react";

export function Card({ className = "", ...props }) {
  return <div className={`rounded-[1.75rem] border border-slate-200 bg-white/95 shadow-sm ${className}`} {...props} />;
}

export function CardContent({ className = "", ...props }) {
  return <div className={className} {...props} />;
}
