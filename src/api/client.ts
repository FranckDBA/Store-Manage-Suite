export const API_BASE_URL = "http://172.22.6.148:8000/api";

export type ApiUser = { id: number; name: string; email: string };
export type ApiProduct = {
  id: number; category_id: number | null; name: string; description: string | null;
  price: string | number; purchase_price: string | number; stock: number; image: string | null;
  is_active: boolean; category?: { id: number; name: string } | null;
};

async function request<T>(path: string, token?: string, options: RequestInit = {}): Promise<T> {
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
    const validation = body?.errors ? Object.values(body.errors).flat().join(" ") : "";
    throw new Error([body?.message, validation, `HTTP ${response.status}`].filter(Boolean).join(" — "));
  }
  return body as T;
}

export function login(email: string, password: string, deviceName = "StoreManager-Mobile") {
  return request<{ message: string; user: ApiUser; token: string }>("/login", undefined, {
    method: "POST", body: JSON.stringify({ email, password, device_name: deviceName }),
  });
}
export function fetchProducts(token: string) { return request<{ data: ApiProduct[] }>("/products", token); }
export function fetchCurrentUser(token: string) { return request<ApiUser>("/user", token); }
export function logout(token: string) { return request<{ message: string }>("/logout", token, { method: "POST" }); }
export function syncSaleToLaravel(token: string, payload: unknown) {
  return request<{ message: string; sale_id: number; already_synced?: boolean }>("/sales/sync", token, { method: "POST", body: JSON.stringify(payload) });
}
export function confirmCurrentPassword(token: string, password: string) {
  return request<{ message: string }>("/confirm-password", token, { method: "POST", body: JSON.stringify({ password }) });
}
export type CreateProductInput = {
  name: string; description?: string | null; price: number; purchase_price: number; stock: number;
  category?: string | null; is_active?: boolean; image_uri?: string | null;
};
export function createProduct(token: string, input: CreateProductInput) {
  return request<{ data?: ApiProduct; product?: ApiProduct; message?: string }>("/products", token, { method: "POST", body: JSON.stringify(input) });
}
export function updateProduct(token: string, id: number, input: Partial<CreateProductInput>) {
  return request<{ data: ApiProduct; message: string }>(`/products/${id}`, token, { method: "PATCH", body: JSON.stringify(input) });
}
export function syncStockMovement(token: string, payload: unknown) {
  return request<{ message: string; movement_id: number; already_synced?: boolean }>("/stock-movements/sync", token, { method: "POST", body: JSON.stringify(payload) });
}
