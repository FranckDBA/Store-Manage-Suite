
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "store_manager_sanctum_token";
const USER_KEY = "store_manager_user";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
};

export async function saveAuthSession(
  token: string,
  user: AuthUser,
): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function getAuthToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const value = await SecureStore.getItemAsync(USER_KEY);

  if (!value) return null;

  try {
    return JSON.parse(value) as AuthUser;
  } catch {
    return null;
  }
}

// Supprime uniquement le jeton d'authentification.
export async function clearAuthToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// Supprime la session complète lors d'une déconnexion normale.
export async function clearAuthSession(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}
