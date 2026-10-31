import type { SQLiteDatabase } from "expo-sqlite";

export type ProductRow = {
  id: number;
  name: string;
  price: number;
  purchase_price: number;
  stock: number;
  category?: string | null;
  image_url?: string | null;
  description?: string | null;
  is_active?: number;
};

export type LocalSale = {
  local_id: string;
  total: number;
  cash_tendered: number;
  change_amount: number;
  status: string;
  created_at: string;
  payload: string;
};

export async function initializeDatabase(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS local_products (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      purchase_price REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      category TEXT,
      updated_at TEXT,
      image_url TEXT,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS pending_sales (
      local_id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      total REAL NOT NULL,
      cash_tendered REAL NOT NULL,
      change_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      synced_at TEXT
    );
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      movement_type TEXT NOT NULL CHECK (movement_type IN ('entry', 'exit', 'adjustment')),
      quantity REAL NOT NULL,
      delta REAL NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_status TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE INDEX IF NOT EXISTS idx_stock_movements_product_date
      ON stock_movements(product_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS pending_product_edits (
      product_id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      purchase_price REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS pending_product_creates (
      local_id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      purchase_price REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      category TEXT,
      description TEXT,
      image_uri TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS store_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      store_name TEXT NOT NULL DEFAULT 'POS MARKET',
      address TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      rccm TEXT NOT NULL DEFAULT '',
      nif TEXT NOT NULL DEFAULT '',
      logo_data_url TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT OR IGNORE INTO store_settings (id, store_name) VALUES (1, 'POS MARKET');
  `);

  // Supprime les anciennes lignes de démonstration créées par les versions précédentes.
  await db.runAsync(
    "DELETE FROM local_products WHERE name IN (?, ?, ?)",
    "Produit démo A",
    "Produit démo B",
    "Produit démo C",
  );

  // Migration pour les bases SQLite déjà créées avant l'ajout du prix d'achat.
  try {
    await db.execAsync("ALTER TABLE local_products ADD COLUMN purchase_price REAL NOT NULL DEFAULT 0;");
  } catch {
    // La colonne existe déjà : rien à faire.
  }

  // Migration pour les bases SQLite déjà créées avant l'ajout des images.
  try { await db.execAsync("ALTER TABLE local_products ADD COLUMN image_url TEXT;"); } catch {}
  try { await db.execAsync("ALTER TABLE local_products ADD COLUMN description TEXT;"); } catch {}
  try { await db.execAsync("ALTER TABLE local_products ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;"); } catch {}
  try { await db.execAsync("ALTER TABLE pending_product_creates ADD COLUMN description TEXT;"); } catch {}
  try { await db.execAsync("ALTER TABLE pending_product_creates ADD COLUMN image_uri TEXT;"); } catch {}
  try { await db.execAsync("ALTER TABLE pending_product_creates ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;"); } catch {}
}

export async function getProducts(db: SQLiteDatabase): Promise<ProductRow[]> {
  return db.getAllAsync<ProductRow>(
    "SELECT id, name, price, purchase_price, stock, category, image_url FROM local_products ORDER BY name COLLATE NOCASE",
  );
}

export async function getSales(db: SQLiteDatabase): Promise<LocalSale[]> {
  return db.getAllAsync<LocalSale>(
    "SELECT local_id, total, cash_tendered, change_amount, status, created_at, payload FROM pending_sales ORDER BY created_at DESC",
  );
}

export async function countPendingSales(db: SQLiteDatabase): Promise<number> {
  const result = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM pending_sales WHERE status='pending'",
  );
  return result?.count ?? 0;
}

/** Remplace le catalogue local par le catalogue actif reçu du serveur. */
export async function syncProducts(
  db: SQLiteDatabase,
  products: {
    id: number; name: string; price: string | number; purchase_price?: string | number | null;
    stock: number;
    category?: { name: string } | string | null;
    image?: string | null;
    description?: string | null;
    is_active?: boolean | number | null;
  }[],
): Promise<void> {
  await db.withTransactionAsync(async () => {
    // Remplacer le catalogue serveur, puis réappliquer les opérations locales en attente.
    await db.runAsync("DELETE FROM local_products WHERE id > 0");
    for (const product of products) {
      const category = typeof product.category === "string" ? product.category : product.category?.name ?? null;
      await db.runAsync(
        `INSERT INTO local_products (id, name, price, purchase_price, stock, category, updated_at, image_url, description, is_active)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, price=excluded.price,
           purchase_price=excluded.purchase_price, stock=excluded.stock, category=excluded.category,
           updated_at=excluded.updated_at, image_url=excluded.image_url,
           description=excluded.description, is_active=excluded.is_active`,
        product.id, product.name, Number(product.price), Number(product.purchase_price ?? 0), product.stock, category, product.image ?? null, product.description ?? null, product.is_active === false || product.is_active === 0 ? 0 : 1,
      );
    }
    const pendingCreates = await db.getAllAsync<{local_id:number;name:string;price:number;purchase_price:number;stock:number;category:string|null;description:string|null;image_uri:string|null;is_active:number}>(
      'SELECT local_id,name,price,purchase_price,stock,category,description,image_uri,is_active FROM pending_product_creates'
    );
    for (const p of pendingCreates) {
      await db.runAsync(`INSERT OR REPLACE INTO local_products (id,name,price,purchase_price,stock,category,updated_at,image_url,description,is_active)
        VALUES (?,?,?,?,?,?,datetime('now'),?,?,?)`, p.local_id,p.name,p.price,p.purchase_price,p.stock,p.category,p.image_uri,p.description,p.is_active);
    }
    const pendingMovements = await db.getAllAsync<{ product_id: number; delta: number }>(
      `SELECT product_id, SUM(delta) AS delta FROM stock_movements WHERE sync_status='pending' GROUP BY product_id`,
    );
    for (const movement of pendingMovements) {
      await db.runAsync('UPDATE local_products SET stock = MAX(0, stock + ?) WHERE id = ?', movement.delta, movement.product_id);
    }
    const pendingEdits = await db.getAllAsync<{product_id:number;name:string;price:number;purchase_price:number}>(
      'SELECT product_id,name,price,purchase_price FROM pending_product_edits'
    );
    for (const edit of pendingEdits) {
      await db.runAsync('UPDATE local_products SET name=?,price=?,purchase_price=? WHERE id=?', edit.name,edit.price,edit.purchase_price,edit.product_id);
    }
  });
}

// Conservée pour compatibilité avec d'anciens appels éventuels, mais ne pas
// l'appeler au démarrage si seuls les produits synchronisés doivent apparaître.
export async function seedDemoProducts(_db: SQLiteDatabase): Promise<void> {
  // Aucun produit de démonstration n'est créé.
}
