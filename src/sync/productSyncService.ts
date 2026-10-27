import type { SQLiteDatabase } from "expo-sqlite";
import { createProduct } from "../api/client";

type PendingCreate = { local_id: number; name: string; price: number; purchase_price: number; stock: number; category: string | null };

/** Envoie les créations hors ligne. Les lignes ne sont supprimées qu'après confirmation serveur. */
export async function syncPendingProductCreates(db: SQLiteDatabase, token: string): Promise<number> {
  const pending = await db.getAllAsync<PendingCreate>(
    "SELECT local_id, name, price, purchase_price, stock, category FROM pending_product_creates ORDER BY created_at ASC"
  );
  let synced = 0;
  for (const item of pending) {
    const response = await createProduct(token, {
      name: item.name,
      price: item.price,
      purchase_price: item.purchase_price,
      stock: item.stock,
      category: item.category,
    });
    const product = response.data ?? response.product;
    if (!product?.id) {
      throw new Error("Laravel n'a pas renvoyé l'identifiant du produit créé. La création reste en attente.");
    }
    await db.withTransactionAsync(async () => {
      // Ne pas écraser un ID serveur existant : la création doit être idempotente côté API.
      await db.runAsync(
        `INSERT OR REPLACE INTO local_products (id,name,price,purchase_price,stock,category,updated_at,image_url)
         VALUES (?,?,?,?,?,?,datetime('now'),?)`,
        product.id, product.name, Number(product.price), Number(product.purchase_price ?? item.purchase_price),
        Number(product.stock ?? item.stock), typeof product.category === "string" ? product.category : product.category?.name ?? item.category,
        product.image ?? null,
      );
      await db.runAsync("DELETE FROM local_products WHERE id = ?", item.local_id);
      await db.runAsync("DELETE FROM pending_product_creates WHERE local_id = ?", item.local_id);
    });
    synced++;
  }
  return synced;
}
