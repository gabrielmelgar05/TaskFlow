import type { ReactNode } from "react";
import { Icon } from "./icon";

export function EmptyState({
  title,
  description,
  children,
  spacious = false,
}: {
  title: string;
  description: string;
  children?: ReactNode;
  spacious?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center px-6 text-center ${spacious ? "py-16 sm:py-20" : "py-9"}`}
    >
      <div className="empty-illustration mb-5" aria-hidden="true">
        <div className="empty-sheet empty-sheet-back" />
        <div className="empty-sheet empty-sheet-front">
          <Icon name="boards" width="27" height="27" />
        </div>
        <span className="empty-spark">
          <Icon name="sparkles" width="19" height="19" />
        </span>
      </div>
      <h3 className="text-xl font-medium tracking-tight">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
        {description}
      </p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
