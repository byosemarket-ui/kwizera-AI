/**
 * React binding for the shared Forex Admin token service.
 */
import { useCallback, useEffect, useState } from "react";
import {
  clearForexAdminToken,
  getForexAdminToken,
  getForexAdminTokenSnapshot,
  saveForexAdminToken,
  subscribeForexAdminToken,
  type ForexAdminTokenSnapshot,
  type SaveForexAdminTokenResult,
} from "./forex-admin-token";

export function useForexAdminToken(): {
  snapshot: ForexAdminTokenSnapshot;
  token: string;
  save: (raw: string) => SaveForexAdminTokenResult;
  clear: () => SaveForexAdminTokenResult;
  refresh: () => void;
} {
  const [snapshot, setSnapshot] = useState<ForexAdminTokenSnapshot>(() => getForexAdminTokenSnapshot());

  useEffect(() => subscribeForexAdminToken(setSnapshot), []);

  const refresh = useCallback(() => {
    setSnapshot(getForexAdminTokenSnapshot());
  }, []);

  const save = useCallback((raw: string) => {
    const result = saveForexAdminToken(raw);
    setSnapshot(result.snapshot);
    return result;
  }, []);

  const clear = useCallback(() => {
    const result = clearForexAdminToken();
    setSnapshot(result.snapshot);
    return result;
  }, []);

  return {
    snapshot,
    token: getForexAdminToken(),
    save,
    clear,
    refresh,
  };
}
