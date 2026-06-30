import { useEffect, useState } from "react";
import { remainingSeconds, type ActiveTimer } from "../../background/logic";
import { getActiveTimer } from "../../shared/activeTimer";

export function useCountdown() {
  const [timer, setTimer] = useState<ActiveTimer | null>(null);
  const [remaining, setRemaining] = useState(0);

  async function refresh() {
    const t = await getActiveTimer();
    setTimer(t);
    if (t) setRemaining(remainingSeconds(t.startAt, t.durationSeconds, Date.now()));
  }

  useEffect(() => {
    void refresh();
    const id = setInterval(() => {
      void refresh();
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return { timer, remaining, refresh };
}
