import { AccountManager } from "applesauce-accounts";
import { ExtensionAccount, registerCommonAccountTypes } from "applesauce-accounts/accounts";
import { ExtensionSigner, NostrConnectSigner } from "applesauce-signers";

import { pool } from "./nostr";

const ACCOUNTS_KEY = "accounts";
const ACTIVE_KEY = "active-account";
// The key the previous version of the app used to remember an extension login
const LEGACY_PUBKEY_KEY = "blossomservers_pubkey";

// NIP-46 signers talk to the remote signer through the app's relay pool
NostrConnectSigner.subscriptionMethod = pool.subscription.bind(pool);
NostrConnectSigner.publishMethod = pool.publish.bind(pool);

export const accounts = new AccountManager();
registerCommonAccountTypes(accounts);

// Restore saved accounts
try {
  const saved = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]");
  accounts.fromJSON(saved, true);
} catch (error) {
  console.warn("Failed to restore accounts", error);
}

// Migrate the extension login from the previous version of the app
const legacyPubkey = localStorage.getItem(LEGACY_PUBKEY_KEY);
if (legacyPubkey && accounts.accounts.length === 0) {
  const account = new ExtensionAccount(legacyPubkey, new ExtensionSigner());
  accounts.addAccount(account);
  accounts.setActive(account);
}
localStorage.removeItem(LEGACY_PUBKEY_KEY);

// Restore the active account
const activeId = localStorage.getItem(ACTIVE_KEY);
if (activeId && accounts.getAccount(activeId)) accounts.setActive(activeId);

// Persist accounts and the active account whenever they change
accounts.accounts$.subscribe(() => {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts.toJSON(true)));
});
accounts.active$.subscribe((account) => {
  if (account) localStorage.setItem(ACTIVE_KEY, account.id);
  else localStorage.removeItem(ACTIVE_KEY);
});
