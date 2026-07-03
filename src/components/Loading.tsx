import { useT } from "../i18n/react";

/** 居中的加载态：旋转环形图标（呼应计时环品牌图标）+ 文案。 */
export function Loading({ label }: { label?: string }) {
  const t = useT();
  return (
    <div
      className="flex h-full min-h-[180px] flex-col items-center justify-center gap-3 text-muted"
      role="status"
      aria-live="polite"
    >
      <svg
        className="h-8 w-8 animate-spin text-accent motion-reduce:animate-none"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.2" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="text-sm">{label ?? t("common.loading")}</span>
    </div>
  );
}
