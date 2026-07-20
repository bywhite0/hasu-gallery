import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpenText, ImagePlus, Plus, X } from "lucide-react";
import { buttonStyles, cn } from "@hasu-gallery/ui";
import { useI18n } from "../i18n";

interface CreateMenuProps {
  className?: string;
  /** Desktop header control vs mobile floating action button */
  placement: "header" | "fab";
}

export function CreateMenu({ className, placement }: CreateMenuProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const items = [
    {
      to: "/upload" as const,
      label: t("nav.newImage"),
      Icon: ImagePlus,
    },
    {
      to: "/profile/fictions" as const,
      label: t("nav.newFiction"),
      Icon: BookOpenText,
    },
  ];

  const menuPositionClass =
    placement === "fab"
      ? "bottom-full right-0 mb-2 origin-bottom-right"
      : "top-full right-0 mt-2 origin-top-right";

  const triggerClass =
    placement === "fab"
      ? cn(
          "inline-flex h-14 w-14 items-center justify-center rounded-full border border-ink bg-ink text-paper shadow-md",
          "transition-colors hover:bg-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
        )
      : buttonStyles({ size: "sm", className: "shrink-0 gap-1.5" });

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        className={triggerClass}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t("nav.newMenu")}
        onClick={() => setOpen((current) => !current)}
      >
        {placement === "fab" ? (
          open ? (
            <X className="h-6 w-6" aria-hidden="true" />
          ) : (
            <Plus className="h-6 w-6" aria-hidden="true" />
          )
        ) : (
          <>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>{t("nav.new")}</span>
          </>
        )}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={t("nav.newMenu")}
          className={cn(
            "absolute z-[60] min-w-48 overflow-hidden rounded-md border border-ink bg-paper py-1 shadow-lg",
            menuPositionClass,
          )}
        >
          {items.map(({ to, label, Icon }) => (
            <Link
              key={to}
              to={to}
              role="menuitem"
              className="flex min-h-11 items-center gap-3 px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              onClick={() => setOpen(false)}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
