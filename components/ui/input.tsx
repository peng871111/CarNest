import { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-bronze", className)} {...props} />;
}
