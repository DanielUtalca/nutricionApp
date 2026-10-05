"use client";

// Hoja inferior modal basada en <dialog> nativo: foco atrapado, Esc cierra,
// clic en el fondo cierra.

import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "@/components/ui/icons";

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
      className="m-0 mt-auto mx-auto w-full max-w-md max-h-[85dvh] rounded-t-3xl bg-bg-surface text-text-primary p-0 backdrop:bg-black/40 open:flex flex-col"
    >
      <div className="flex items-center justify-between gap-2 px-5 pt-5 pb-3">
        <h2 className="text-lg font-bold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center text-text-secondary hover:bg-bg-subtle cursor-pointer"
          aria-label="Cerrar"
        >
          <CloseIcon size={20} />
        </button>
      </div>
      <div className="overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">{children}</div>
    </dialog>
  );
}
