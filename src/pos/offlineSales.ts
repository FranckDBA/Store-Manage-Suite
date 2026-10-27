import type { SQLiteDatabase } from "expo-sqlite";
import type { CartLine } from "./cart";

function makeLocalId(): string { return `local-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`; }
type Payload = { total?: number; items?: Array<{ product_id:number; quantity:number }>; cancellation?: {reason:string;cancelled_at:string;refund_amount:number} };

export async function saveOfflineSale(db:SQLiteDatabase,cart:CartLine[],cashTendered:number):Promise<string>{
  const total=Math.round(cart.reduce((s,x)=>s+x.product.price*x.quantity,0)*100)/100;
  if(!cart.length)throw new Error("Le panier est vide.");
  if(!Number.isFinite(cashTendered)||cashTendered<total)throw new Error("Le montant reçu est inférieur au total.");
  const id=makeLocalId(),created=new Date().toISOString(),change=Math.round((cashTendered-total)*100)/100;
  const payload={client_sale_id:id,items:cart.map(x=>({product_id:x.product.id,quantity:x.quantity,unit_price_at_sale:x.product.price,unit_cost_at_sale:x.product.purchase_price,product_name_at_sale:x.product.name})),total,cash_tendered:cashTendered,change_amount:change,created_at:created};
  await db.withTransactionAsync(async()=>{
    for(const l of cart){const r=await db.getFirstAsync<{stock:number}>("SELECT stock FROM local_products WHERE id=?",l.product.id);if(!r||r.stock<l.quantity)throw new Error(`Stock local insuffisant pour ${l.product.name}.`);}
    await db.runAsync("INSERT INTO pending_sales(local_id,payload,total,cash_tendered,change_amount,status,created_at) VALUES(?,?,?,?,?,'pending',?)",id,JSON.stringify(payload),total,cashTendered,change,created);
    for(const l of cart)await db.runAsync("UPDATE local_products SET stock=stock-? WHERE id=?",l.quantity,l.product.id);
  });return id;
}

/** Annule une vente encore locale et restaure son stock dans la même transaction. */
export async function cancelOfflineSale(db:SQLiteDatabase,localId:string,reason:string):Promise<void>{
  await db.withTransactionAsync(async()=>{
    const sale=await db.getFirstAsync<{payload:string;status:string}>("SELECT payload,status FROM pending_sales WHERE local_id=?",localId);
    if(!sale)throw new Error("Vente introuvable dans la base locale.");
    if(sale.status==="cancelled")throw new Error("Cette vente est déjà annulée.");
    if(sale.status!=="pending")throw new Error("Cette vente a quitté la file locale. Une route d'annulation Laravel est nécessaire.");
    let payload:Payload;try{payload=JSON.parse(sale.payload) as Payload;}catch{throw new Error("Données de vente invalides : stock non modifié.");}
    if(!Array.isArray(payload.items)||payload.items.length===0)throw new Error("Articles de vente introuvables : stock non modifié.");
    for(const item of payload.items){if(!Number.isInteger(item.product_id)||!Number.isFinite(item.quantity)||item.quantity<=0)throw new Error("Détail de vente invalide : stock non modifié.");}
    const result=await db.runAsync("UPDATE pending_sales SET status='cancelled' WHERE local_id=? AND status='pending'",localId);
    if(result.changes!==1)throw new Error("La vente a changé d'état. Recharge les données avant de réessayer.");
    for(const item of payload.items)await db.runAsync("UPDATE local_products SET stock=stock+? WHERE id=?",item.quantity,item.product_id);
    payload.cancellation={reason:reason.trim()||"Annulation par le caissier",cancelled_at:new Date().toISOString(),refund_amount:payload.total??0};
    await db.runAsync("UPDATE pending_sales SET payload=? WHERE local_id=?",JSON.stringify(payload),localId);
  });
}
