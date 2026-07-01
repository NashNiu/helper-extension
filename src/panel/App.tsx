import { useState } from "react";
import { useAuth } from "./useAuth";
import { LoginView } from "./LoginView";
import { ProfileView } from "./ProfileView";
import { TabBar, type TabKey } from "../components/TabBar";
import { QuickAddBar } from "../features/QuickAddBar";
import { ReminderView } from "../features/reminder/ReminderView";
import { TimerView } from "../features/timer/TimerView";
import { TodoView } from "../features/todo/TodoView";

export default function App() {
  const { user, status, signIn, signOut } = useAuth();
  const [tab, setTab] = useState<TabKey>("todo");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showLogin, setShowLogin] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  if (status === "loading") {
    return <div className="flex h-full items-center justify-center text-muted">加载中…</div>;
  }

  const loggedIn = status === "in";
  // 登录态切换后，列表数据源也随之切换（本地 ↔ 后端），需强制各视图重新加载。
  const bump = () => setRefreshKey((k) => k + 1);

  const handleLogin = async (id: string, pw: string) => {
    await signIn(id, pw);
    setShowLogin(false);
    bump();
  };

  const handleSignOut = async () => {
    await signOut();
    bump();
  };

  if (showLogin && !loggedIn) {
    return <LoginView onLogin={handleLogin} onCancel={() => setShowLogin(false)} />;
  }

  return (
    <div className="relative flex h-full flex-col bg-ground">
      <TabBar
        value={tab}
        onChange={setTab}
        loggedIn={loggedIn}
        userInitial={user?.username?.slice(0, 1) ?? ""}
        onOpenProfile={() => setShowProfile(true)}
      />
      {/* “一句话智能添加”对登录/未登录都可用：登录走后端 AI，未登录走公开 AI 接口 + 写本地。 */}
      <QuickAddBar onAdded={bump} loggedIn={loggedIn} />
      <main className="min-h-0 flex-1 overflow-y-auto">
        {tab === "reminder" && <ReminderView refreshKey={refreshKey} />}
        {tab === "timer" && <TimerView refreshKey={refreshKey} />}
        {tab === "todo" && <TodoView refreshKey={refreshKey} />}
      </main>

      {showProfile && (
        <ProfileView
          loggedIn={loggedIn}
          userName={user?.username ?? ""}
          userEmail={user?.email ?? ""}
          onBack={() => setShowProfile(false)}
          onSignIn={() => setShowLogin(true)}
          onSignOut={handleSignOut}
        />
      )}
    </div>
  );
}
