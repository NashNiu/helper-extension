import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 通用「分页 + 触底加载更多」列表 hook。
 *
 * - 首屏加载第 0 页；`refreshKey` 变化时重置回第 0 页。
 * - 以「当前已加载条数」作为下一页 offset，天然兼容乐观删除/完成后条目减少的场景，
 *   不会漏取也不会重取。
 * - 追加时按 id 去重：即便后端尚未支持 limit/offset（旧版会忽略参数返回全部），
 *   也不会产生重复项或无限加载。
 * - 通过返回的 `sentinelRef` 挂到列表末尾的哨兵元素上，进入视口即自动加载下一页。
 */
export function useInfiniteList<T extends { id: number }>(
  fetchPage: (offset: number, limit: number) => Promise<T[]>,
  refreshKey: number,
  pageSize = 10,
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [err, setErr] = useState("");

  // 用 ref 镜像最新值，让 loadMore 保持稳定引用又能读到当前状态。
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const itemsRef = useRef<T[]>(items);
  itemsRef.current = items;
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;
  const busyRef = useRef(false);

  const loadFirst = useCallback(async () => {
    busyRef.current = true;
    setLoading(true);
    setErr("");
    try {
      const page = await fetchRef.current(0, pageSize);
      setItems(page);
      setHasMore(page.length === pageSize);
    } catch {
      setErr("加载失败");
    } finally {
      setLoading(false);
      busyRef.current = false;
    }
  }, [pageSize]);

  useEffect(() => {
    void loadFirst();
  }, [loadFirst, refreshKey]);

  const loadMore = useCallback(async () => {
    if (busyRef.current || !hasMoreRef.current) return;
    busyRef.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchRef.current(itemsRef.current.length, pageSize);
      setItems((xs) => {
        const seen = new Set(xs.map((x) => x.id));
        const fresh = page.filter((p) => !seen.has(p.id));
        // 没有新条目 → 已到底（或后端忽略了分页参数），停止继续加载。
        setHasMore(fresh.length > 0 && page.length === pageSize);
        return fresh.length > 0 ? [...xs, ...fresh] : xs;
      });
    } catch {
      setErr("加载更多失败");
    } finally {
      setLoadingMore(false);
      busyRef.current = false;
    }
  }, [pageSize]);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      observerRef.current?.disconnect();
      if (!node || typeof IntersectionObserver === "undefined") return;
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) void loadMore();
        },
        { rootMargin: "200px" },
      );
      observerRef.current.observe(node);
    },
    [loadMore],
  );

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return { items, setItems, loading, loadingMore, hasMore, err, setErr, sentinelRef };
}
