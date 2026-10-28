import type { SQLiteDatabase } from "expo-sqlite";
import { getAuthToken } from "../api/authStorage";
import { syncSaleToLaravel } from "../api/client";

type PendingSale = { local_id: string; payload: string; status: string };

export async function syncPendingSales(db: SQLiteDatabase): Promise<{ ok: boolean; message: string }> {
  const token = await getAuthToken();
  if (!token) return { ok: false, message: "Connecte-toi pour synchroniser les ventes." };

  const pending = await db.getAllAsync<PendingSale>(
    "SELECT local_id, payload, status FROM pending_sales WHERE status='pending' ORDER BY created_at ASC"
  );
  if (!pending.length) return { ok: true, message: "Aucune vente en attente de synchronisation." };

  let synced = 0;
  const errors: string[] = [];
  for (const sale of pending) {
    try {
      const payload = JSON.parse(sale.payload);
      await syncSaleToLaravel(token, payload);
      await db.runAsync(
        "UPDATE pending_sales SET status='synced', synced_at=datetime('now') WHERE local_id=? AND status='pending'",
        sale.local_id
      );
      synced++;
    } catch (e) {
      errors.push(`${sale.local_id}: ${e instanceof Error ? e.message : "erreur inconnue"}`);
    }
  }
  if (errors.length) {
    return { ok: synced > 0, message: `${synced} vente(s) synchronisée(s), ${errors.length} échec(s). ${errors.slice(0,2).join(" ; ")}` };
  }
  return { ok: true, message: `${synced} vente(s) synchronisée(s).` };
}
