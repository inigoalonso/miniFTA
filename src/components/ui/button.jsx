import React from "react";

export function Button({
  className = "",
  variant = "default",
  size = "default",
  disabled,
  children,
  ...props
}) {
  const base =
    "inline-flex items-center justify-center font-medium transition disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    default: "bg-slate-950 text-white hover:bg-slate-800",
    outline: "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
    ghost: "bg-transparent hover:bg-slate-100",
    destructive: "bg-red-600 text-white hover:bg-red-700",
  };
  const sizes = {
    default: "h-10 px-4 py-2",
    icon: "h-10 w-10",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
