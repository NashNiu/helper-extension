import { useEffect, useState } from "react";
import type { TodoImage } from "../../shared/api/todo";
import { useT } from "../../i18n/react";

function XIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/**
 * 待办的图片缩略图行。只有带图的待办才渲染它(空数组返回 null),所以不带图的行零变化。
 *
 * onRemove 省略 = 只读(列表默认态);传入 = 每张右上角出现删除按钮(编辑态)。
 */
export function TodoImageStrip({
  images,
  onRemove,
}: {
  images: TodoImage[];
  onRemove?: (imageId: number) => void;
}) {
  const t = useT();
  // 存图片的 id 而不是它在 sorted 里的下标——下标在图片被删除后会指向别的图片,
  // 甚至指向不存在的位置(数组变短),导致 sorted[preview] 在渲染期抛错(见本文件的
  // 修复记录)。存 id 后,预览的图片被删掉时 shown 自然找不到,预览随之自己关闭。
  const [preview, setPreview] = useState<number | null>(null);
  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order);
  const shown = sorted.find((x) => x.id === preview);

  // 预览打开时按 Esc 关闭。
  useEffect(() => {
    if (preview === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreview(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [preview]);

  if (sorted.length === 0) return null;

  return (
    <>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {sorted.map((img, i) => (
          <div key={img.id} className="relative">
            <button
              type="button"
              onClick={() => setPreview(img.id)}
              aria-label={t("todo.viewImageAria", { n: i + 1 })}
              className="block h-10 w-10 overflow-hidden rounded-md border border-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <img src={img.url} alt="" className="h-full w-full object-cover" />
            </button>
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(img.id)}
                aria-label={t("todo.removeImageAria", { n: i + 1 })}
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <XIcon />
              </button>
            )}
          </div>
        ))}
      </div>

      {shown && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("todo.imagePreviewAria")}
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <img
            src={shown.url}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}
    </>
  );
}
