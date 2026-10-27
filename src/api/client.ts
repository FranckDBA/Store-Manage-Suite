
export const API_BASE_URL = "http://172.22.6.148:8000/api";

export type ApiUser = {
  id: number;
  name: string;
  email: string;
};

export type ApiProduct = {
  id: number;
  category_id: number | null;
  name: string;
  description: string | null;
  price: string | number;
  purchase_price: string | number;
  stock: number;
  image: string | null;
  is_active: boolean;
  category?: {
    id: number;
    name: string;
  } | null;
};

async function request<T>(
  path: string,
  token?: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      body?.message ?? `Erreur API HTTP ${response.status}`,
    );
  }

  return body as T;
}

export async function login(
  email: string,
  password: string,
  deviceName = "StoreManager-Mobile",
) {
  return request<{
    message: string;
    user: ApiUser;
    token: string;
  }>("/login", undefined, {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      device_name: deviceName,
    }),
  });
}

export async function fetchProducts(token: string) {
  return request<{ data: ApiProduct[] }>("/products", token);
}
export async function fetchCurrentUser(token: string) {
  return request<ApiUser>("/user", token);
}

export async function logout(token: string) {
  return request<{ message: string }>("/logout", token, {
    method: "POST",
  });
}


export async function syncSaleToLaravel(token: string, payload: unknown) {
  return request<{ message: string; sale_id: number; already_synced?: boolean }>(
    "/sales/sync",
    token,
    { method: "POST", body: JSON.stringify(payload) },
  );
}


/** Vérifie le mot de passe de l'utilisateur connecté sans créer de nouveau jeton Sanctum.
 * Nécessite POST /api/confirm-password protégé par auth:sanctum côté Laravel.
 */
export async function confirmCurrentPassword(token: string, password: string) {
  return request<{ message: string }>("/confirm-password", token, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}


export type CreateProductInput = {
  name: string;
  description?: string | null;
  price: number;
  purchase_price: number;
  stock: number;
  category?: string | null;
  is_active?: boolean;
  /** URI locale uniquement : l'API JSON actuelle ne téléverse pas les fichiers. */
  image_uri?: string | null;
};

/** Crée un produit via l'API Laravel. Nécessite POST /api/products avec auth:sanctum. */
export async function createProduct(token: string, input: CreateProductInput) {
  return request<{ data?: ApiProduct; product?: ApiProduct; message?: string }>(
    "/products",
    token,
    { method: "POST", body: JSON.stringify(input) },
  );
}
