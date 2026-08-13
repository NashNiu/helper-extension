import { useState } from "react";
import { useT } from "../i18n/react";
import { useAuth } from "./useAuth";
import { ProfileView } from "./ProfileView";
import { TabBar, type TabKey } from "../components/TabBar";
import { QuickAddBar } from "../features/QuickAddBar";
import { ReminderView } from "../features/reminder/ReminderView";
import { TimerView } from "../features/timer/TimerView";
import { TimerWidget } from "../features/timer/TimerWidget";
import { TodoView } from "../features/todo/TodoView";
import { TodoCategoryBar, type CategorySelection } from "../features/todo/TodoCategoryBar";
import { useTodoCategories } from "../features/todo/useTodoCategories";
import { ClipboardView } from "../features/clipboard/ClipboardView";

export default function App() {
  const t = useT();
  const { status } = useAuth();
  const [tab, setTab] = useState<TabKey>("todo");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showProfile, setShowProfile] = useState(false);
  // 分类状态住在这里,因为 QuickAddBar 与 TodoView 是兄弟节点:前者要拿选中的分类
  // 作为新建默认值,后者要拿分类名渲染标签。
  const [category, setCategory] = useState<CategorySelection>(null);
  const cats = useTodoCategories(refreshKey);

  if (status === "loading") {
    return <div className="flex h-full items-center justify-center text-muted">{t("common.loading")}</div>;
  }

  const showWidget = tab !== "timer" && !showProfile;
  // 登录态切换后，列表数据源也随之切换（本地 ↔ 后端），需强制各视图重新加载。
  const bump = () => setRefreshKey((k) => k + 1);

  // 删分类会把其中的待办变成未分类，列表内容真的变了，必须重拉；
  // 当前筛选的就是被删的那个分类时还要退回「全部」，否则会停在一个空列表上。
  // 重命名不用重拉——待办只存 category_id，名字是渲染时从分类列表里查的。
  const removeCategory = async (id: number) => {
    await cats.remove(id);
    if (category === id) setCategory(null);
    bump();
  };

  return (
    <div className="relative flex h-full flex-col overflow-x-clip bg-ground">
      <TabBar
        value={tab}
        onChange={setTab}
        onOpenProfile={() => setShowProfile(true)}
      />
      {/* “一句话智能添加”配置了 DeepSeek Key 走 AI 解析（失败自动回退本地），未配置走本地规则解析。
          剪贴板 tab 不涉及添加；计时 tab 只用预设，不接受一句话添加，故均隐藏。 */}
      {tab !== "clipboard" && tab !== "timer" && (
        <QuickAddBar
          onAdded={bump}
          // 选中的分类同时是新建待办的归属。"none"(未分类)与「全部」一样不带分类。
          categoryId={typeof category === "number" ? category : null}
        />
      )}
      {tab === "todo" && (
        <TodoCategoryBar
          categories={cats.categories}
          selected={category}
          onSelect={setCategory}
          onCreate={cats.create}
          onRename={cats.rename}
          onRemove={removeCategory}
        />
      )}
      <main className="min-h-0 flex-1 overflow-y-auto">
        {tab === "reminder" && <ReminderView refreshKey={refreshKey} />}
        {tab === "timer" && <TimerView refreshKey={refreshKey} />}
        {tab === "todo" && (
          <TodoView refreshKey={refreshKey} category={category} categories={cats.categories} />
        )}
        {tab === "clipboard" && <ClipboardView refreshKey={refreshKey} />}
      </main>

      {showWidget && <TimerWidget onOpen={() => setTab("timer")} />}

      {showProfile && (
        <ProfileView onBack={() => setShowProfile(false)} onChanged={bump} />
      )}
    </div>
  );
}
