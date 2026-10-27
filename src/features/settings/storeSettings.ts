import type { SQLiteDatabase } from "expo-sqlite";

export type StoreSettings = {
  store_name: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  rccm: string;
  nif: string;
  logo_data_url: string;
};

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  store_name: "POS MARKET",
  address: "",
  city: "",
  country: "",
  phone: "",
  email: "",
  rccm: "",
  nif: "",
  logo_data_url: "",
};

export async function getStoreSettings(db: SQLiteDatabase): Promise<StoreSettings> {
  const row = await db.getFirstAsync<StoreSettings>(
    `SELECT store_name, address, city, country, phone, email, rccm, nif, logo_data_url
     FROM store_settings WHERE id = 1`,
  );
  return row ? { ...DEFAULT_STORE_SETTINGS, ...row } : DEFAULT_STORE_SETTINGS;
}

export async function saveStoreSettings(
  db: SQLiteDatabase,
  settings: StoreSettings,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO store_settings
      (id, store_name, address, city, country, phone, email, rccm, nif, logo_data_url, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       store_name = excluded.store_name,
       address = excluded.address,
       city = excluded.city,
       country = excluded.country,
       phone = excluded.phone,
       email = excluded.email,
       rccm = excluded.rccm,
       nif = excluded.nif,
       logo_data_url = excluded.logo_data_url,
       updated_at = datetime('now')`,
    settings.store_name.trim() || "POS MARKET",
    settings.address.trim(),
    settings.city.trim(),
    settings.country.trim(),
    settings.phone.trim(),
    settings.email.trim(),
    settings.rccm.trim(),
    settings.nif.trim(),
    settings.logo_data_url,
  );
}
