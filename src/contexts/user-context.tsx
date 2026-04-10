import { createContext, useContext, useEffect, useState } from "react";
import { getPubkey } from "../nostr";

const STORAGE_KEY = "blossomservers_pubkey";

type UserContextType = {
  pubkey: string | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  login: () => Promise<void>;
  logout: () => void;
};

const UserContext = createContext<UserContextType>({
  pubkey: null,
  isLoading: true,
  isLoggedIn: false,
  login: async () => {},
  logout: () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setPubkey(stored);
    }
    setIsLoading(false);
  }, []);

  const login = async () => {
    try {
      const pubkey = await getPubkey();
      if (pubkey) {
        setPubkey(pubkey);
        localStorage.setItem(STORAGE_KEY, pubkey);
      }
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    setPubkey(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <UserContext.Provider value={{ pubkey, isLoading, isLoggedIn: pubkey !== null, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
