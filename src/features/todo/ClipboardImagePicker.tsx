import { useEffect, useState } from "react";
import { getItems, type ClipItem } from "../../shared/clipboardStore";
import { useT } from "../../i18n/react";

/** 从剪贴板板里挑一张图。板里的图片本来就以 dataUrl 存着,选中后直接回传。 */
export function ClipboardImagePicker({
  onPick,
  onClose,
}: {
  onPick: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [images, setImages] = useState<ClipItem[] | null>(null);

  useEffect(() => {
    void getItems().then((all) =>
      setImages(all.filter((i) => i.type === "image" && i.dataUrl)),
    );
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("todo.imagePickTitle")}
      className="fixed inset-0 z-50 flex flex-col bg-ground"
    >
      <div className="flex items-center justify-between border-b border-line bg-surface px-3 py-2">
        <span className="text-sm font-semibold text-ink">{t("todo.imagePickTitle")}</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-sm text-muted hover:text-ink"
        >
          {t("action.cancel")}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {images === null ? null : images.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">{t("todo.imagePickEmpty")}</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {images.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => onPick(it.dataUrl!)}
                className="aspect-square overflow-hidden rounded-md border border-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <img src={it.dataUrl} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
