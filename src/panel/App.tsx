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
import { ClipboardView } from "../features/clipboard/ClipboardView";

export default function App() {
  const t = useT();
  const { status } = useAuth();
  const [tab, setTab] = useState<TabKey>("todo");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showProfile, setShowProfile] = useState(false);

  if (status === "loading") {
    return <div className="flex h-full items-center justify-center text-muted">{t("common.loading")}</div>;
  }

  const showWidget = tab !== "timer" && !showProfile;
  // 登录态切换后，列表数据源也随之切换（本地 ↔ 后端），需强制各视图重新加载。
  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <div className="relative flex h-full flex-col overflow-x-clip bg-ground">
      <TabBar
        value={tab}
        onChange={setTab}
        onOpenProfile={() => setShowProfile(true)}
      />
      {/* “一句话智能添加”配置了 DeepSeek Key 走 AI 解析（失败自动回退本地），未配置走本地规则解析。
          剪贴板 tab 不涉及添加；计时 tab 只用预设，不接受一句话添加，故均隐藏。 */}
      {tab !== "clipboard" && tab !== "timer" && <QuickAddBar onAdded={bump} />}
      <main className="min-h-0 flex-1 overflow-y-auto">
        {tab === "reminder" && <ReminderView refreshKey={refreshKey} />}
        {tab === "timer" && <TimerView refreshKey={refreshKey} />}
        {tab === "todo" && <TodoView refreshKey={refreshKey} />}
        {tab === "clipboard" && <ClipboardView refreshKey={refreshKey} />}
      </main>

      {showWidget && <TimerWidget onOpen={() => setTab("timer")} />}

      {showProfile && (
        <ProfileView onBack={() => setShowProfile(false)} onChanged={bump} />
      )}
    </div>
  );
}
