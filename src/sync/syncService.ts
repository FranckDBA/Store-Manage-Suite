import type { SQLiteDatabase } from "expo-sqlite";
import { getAuthToken } from "../api/authStorage";
import { syncSaleToLaravel, syncStockMovement, updateProduct } from "../api/client";

type PendingSale = { local_id: string; payload: string };
type PendingEdit = { product_id: number; name: string; price: number; purchase_price: number };
type PendingMovement = { id: number; client_movement_id: string | null; product_id: number; product_name: string; movement_type: "entry" | "exit" | "adjustment"; quantity: number; delta: number; reason: string; created_at: string };

export async function syncPendingSales(db: SQLiteDatabase): Promise<{ ok: boolean; message: string }> {
  const token = await getAuthToken();
  if (!token) return { ok: false, message: "Connecte-toi pour synchroniser les données." };
  let synced = 0;
  const errors: string[] = [];

  const pendingEdits = await db.getAllAsync<PendingEdit>("SELECT product_id,name,price,purchase_price FROM pending_product_edits ORDER BY updated_at ASC");
  for (const edit of pendingEdits) {
    try {
      await updateProduct(token, edit.product_id, { name: edit.name, price: edit.price, purchase_price: edit.purchase_price });
      await db.runAsync("DELETE FROM pending_product_edits WHERE product_id=?", edit.product_id);
      synced++;
    } catch (e) { errors.push(`Produit ${edit.product_id}: ${e instanceof Error ? e.message : "erreur inconnue"}`); }
  }

  const movements = await db.getAllAsync<PendingMovement>("SELECT id,client_movement_id,product_id,product_name,movement_type,quantity,delta,reason,created_at FROM stock_movements WHERE sync_status='pending' ORDER BY created_at ASC,id ASC");
  for (const movement of movements) {
    try {
      let movementId = movement.client_movement_id;
      if (!movementId) {
        movementId = `mobile-${Date.now()}-${movement.id}-${Math.random().toString(36).slice(2, 10)}`;
        await db.runAsync("UPDATE stock_movements SET client_movement_id=? WHERE id=? AND client_movement_id IS NULL", movementId, movement.id);
      }
      await syncStockMovement(token, {
        client_movement_id: movementId, product_id: movement.product_id,
        movement_type: movement.movement_type, quantity: movement.quantity, delta: movement.delta,
        reason: movement.reason, created_at: movement.created_at,
      });
      await db.runAsync("UPDATE stock_movements SET sync_status='synced' WHERE id=? AND sync_status='pending'", movement.id);
      synced++;
    } catch (e) { errors.push(`Stock ${movement.product_name}: ${e instanceof Error ? e.message : "erreur inconnue"}`); }
  }

  const pending = await db.getAllAsync<PendingSale>("SELECT local_id,payload FROM pending_sales WHERE status='pending' ORDER BY created_at ASC");
  for (const sale of pending) {
    try {
      await syncSaleToLaravel(token, JSON.parse(sale.payload));
      await db.runAsync("UPDATE pending_sales SET status='synced', synced_at=datetime('now') WHERE local_id=? AND status='pending'", sale.local_id);
      synced++;
    } catch (e) { errors.push(`Vente ${sale.local_id}: ${e instanceof Error ? e.message : "erreur inconnue"}`); }
  }

  if (errors.length) return { ok: synced > 0, message: `${synced} opération(s) synchronisée(s), ${errors.length} échec(s). ${errors.slice(0, 3).join(" ; ")}` };
  return { ok: true, message: synced ? `${synced} opération(s) synchronisée(s).` : "Aucune opération en attente de synchronisation." };
}
