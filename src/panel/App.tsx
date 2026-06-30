import { useState } from "react";
import { useAuth } from "./useAuth";
import { LoginView } from "./LoginView";
import { TabBar, type TabKey } from "../components/TabBar";
import { QuickAddBar } from "../features/QuickAddBar";
import { ReminderView } from "../features/reminder/ReminderView";
import { TimerView } from "../features/timer/TimerView";
import { TodoView } from "../features/todo/TodoView";

export default function App() {
  const { status, signIn, signOut } = useAuth();
  const [tab, setTab] = useState<TabKey>("reminder");
  const [refreshKey, setRefreshKey] = useState(0);

  if (status === "loading") {
    return <div className="flex h-full items-center justify-center text-muted">加载中…</div>;
  }
  if (status === "out") {
    return <LoginView onLogin={signIn} />;
  }

  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <div className="flex h-full flex-col bg-ground">
      <TabBar value={tab} onChange={setTab} onSignOut={signOut} />
      <QuickAddBar onAdded={bump} />
      <main className="min-h-0 flex-1 overflow-y-auto">
        {tab === "reminder" && <ReminderView refreshKey={refreshKey} />}
        {tab === "timer" && <TimerView />}
        {tab === "todo" && <TodoView refreshKey={refreshKey} />}
      </main>
    </div>
  );
}
