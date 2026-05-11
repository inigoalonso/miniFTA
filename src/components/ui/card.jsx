import React from "react";

export function Card({ className = "", ...props }) {
  return <div className={`rounded-xl border bg-white ${className}`} {...props} />;
}

export function CardContent({ className = "", ...props }) {
  return <div className={className} {...props} />;
}
