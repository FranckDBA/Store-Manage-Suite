
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { initializeDatabase } from "../src/db/database";
import {
  clearAuthSession,
  getAuthToken,
  getAuthUser,
} from "../src/api/authStorage";
import { fetchCurrentUser } from "../src/api/client";

import "../global.css";

type AuthContextValue = {
  authenticated: boolean;
  setAuthenticated: (value: boolean) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAppAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAppAuth doit être utilisé dans AuthProvider.");
  }

  return context;
}

function SessionGuard() {
  const router = useRouter();
  const segments = useSegments();
  const { authenticated, setAuthenticated } = useAppAuth();
  const [checking, setChecking] = useState(true);

  const checkSession = useCallback(async () => {
    try {
      const token = await getAuthToken();
      const user = await getAuthUser();

      if (!token || !user) {
        setAuthenticated(false);
        return;
      }

      try {
        await fetchCurrentUser(token);
        setAuthenticated(true);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);

        if (/HTTP 401|HTTP 403|Unauthenticated/i.test(message)) {
          await clearAuthSession();
          setAuthenticated(false);
        } else {
          // En cas d'erreur réseau, préserver la session locale.
          setAuthenticated(true);
        }
      }
    } catch (error) {
      console.error("[SESSION CHECK]", error);
      setAuthenticated(false);
    } finally {
      setChecking(false);
    }
  }, [setAuthenticated]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (checking) return;

    const onLoginScreen = segments[0] === "login";

    if (!authenticated && !onLoginScreen) {
      router.replace("/login");
    } else if (authenticated && onLoginScreen) {
      router.replace("/");
    }
  }, [authenticated, checking, segments, router]);

  if (checking) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#15803D" />
        <Text className="mt-4 text-sm text-slate-500">
          Vérification de la session...
        </Text>
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);

  return (
    <AuthContext.Provider value={{ authenticated, setAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SQLiteProvider
        databaseName="store-manager-suite.db"
        onInit={initializeDatabase}
      >
        <StatusBar style="dark" />
        <AuthProvider>
          <SessionGuard />
        </AuthProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
