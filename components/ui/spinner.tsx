import { cn } from "@/lib/cn";

export function Spinner({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={cn(
        "inline-block rounded-full border-2 border-current border-t-transparent animate-spin",
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}

export function FullScreenSpinner() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-bg-base text-primary">
      <Spinner size={32} />
    </div>
  );
}
