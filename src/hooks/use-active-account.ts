import { use$ } from "applesauce-react/hooks";

import { accounts } from "@/services/accounts";

/** The active account, or undefined when signed out */
export function useActiveAccount() {
  return use$(accounts.active$);
}

/** The pubkey of the active account, or undefined when signed out */
export function useActivePubkey() {
  return useActiveAccount()?.pubkey;
}
