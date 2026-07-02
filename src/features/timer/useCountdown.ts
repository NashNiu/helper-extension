import { useEffect, useState } from "react";
import { displayRemaining, type ActiveTimer } from "../../background/logic";
import { getActiveTimer } from "../../shared/activeTimer";

export function useCountdown() {
  const [timer, setTimer] = useState<ActiveTimer | null>(null);
  const [remaining, setRemaining] = useState(0);

  async function refresh() {
    const t = await getActiveTimer();
    setTimer(t);
    setRemaining(t ? displayRemaining(t, Date.now()) : 0);
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
