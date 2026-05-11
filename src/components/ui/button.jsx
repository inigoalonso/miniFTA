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
    "inline-flex items-center justify-center rounded-[1.5rem] border font-semibold transition duration-200 ease-out disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    default: "bg-slate-950 text-white border-transparent shadow-sm hover:bg-slate-800",
    outline: "border border-slate-200 bg-white text-slate-950 hover:bg-slate-50",
    ghost: "bg-transparent text-slate-900 hover:bg-slate-100",
    destructive: "bg-red-600 text-white border-transparent shadow-sm hover:bg-red-700",
  };
  const sizes = {
    default: "h-11 px-4",
    icon: "h-11 w-11",
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
