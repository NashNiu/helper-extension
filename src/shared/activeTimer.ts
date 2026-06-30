import { storageGet, storageRemove, storageSet } from "./storage";
import type { ActiveTimer } from "../background/logic";

export const ACTIVE_TIMER_KEY = "helper.timer.active";

export function getActiveTimer(): Promise<ActiveTimer | null> {
  return storageGet<ActiveTimer>(ACTIVE_TIMER_KEY);
}

export async function setActiveTimer(t: ActiveTimer | null): Promise<void> {
  if (t === null) await storageRemove(ACTIVE_TIMER_KEY);
  else await storageSet(ACTIVE_TIMER_KEY, t);
}
