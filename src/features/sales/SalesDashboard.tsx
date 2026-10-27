import React from "react";
import { Text, View } from "react-native";
import type { ProductRow, LocalSale } from "../../db/database";

type Props = {
  products: ProductRow[];
  sales: LocalSale[];
  formatMoney: (amount: number) => string;
};

type SaleItem = {
  product_id?: number | string;
  quantity?: number | string;
  qty?: number | string;
  // The current offline sales payload uses unit_price_at_sale.
  unit_price_at_sale?: number | string;
  unit_price?: number | string;
  price?: number | string;
  // Only sale-time cost snapshots are valid for an exact historical profit.
  unit_cost_at_sale?: number | string | null;
  purchase_price_at_sale?: number | string | null;
  unit_cost?: number | string | null;
};

type SalePayload = {
  items?: SaleItem[];
  cancellation?: unknown;
};

function parseSalePayload(payload: unknown): SalePayload | null {
  if (typeof payload !== "string" || payload.trim() === "") return null;
  try {
    const parsed: unknown = JSON.parse(payload);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as SalePayload;
  } catch {
    return null;
  }
}

function isCancelled(sale: LocalSale, payload: SalePayload | null): boolean {
  const status = String(sale.status ?? "").trim().toLowerCase();
  return ["cancelled", "canceled", "annulée", "annulee", "void"].includes(status) || Boolean(payload?.cancellation);
}

/** Dashboard compact intégré dans l'onglet Ventes. */
export default function SalesDashboard({ products, sales, formatMoney }: Props) {
  const parsedSales = sales.map((sale) => ({ sale, payload: parseSalePayload(sale.payload) }));
  const validSales = parsedSales.filter(({ sale, payload }) => !isCancelled(sale, payload));

  const salesTotal = validSales.reduce(
    (sum, { sale }) => sum + Math.max(0, Number(sale.total) || 0),
    0,
  );

  const stockValue = products.reduce(
    (sum, product) =>
      sum + Math.max(0, Number(product.stock) || 0) * Math.max(0, Number(product.price) || 0),
    0,
  );

  const unitsInStock = products.reduce(
    (sum, product) => sum + Math.max(0, Number(product.stock) || 0),
    0,
  );

  let grossProfit = 0;
  let profitDataComplete = true;
  let profitLineCount = 0;

  for (const { payload } of validSales) {
    // The local sale payload structure is { items: [...] }.
    if (!Array.isArray(payload?.items) || payload.items.length === 0) {
      profitDataComplete = false;
      continue;
    }

    for (const item of payload.items) {
      const quantity = Number(item.quantity ?? item.qty);
      const unitPrice = Number(item.unit_price_at_sale ?? item.unit_price ?? item.price);
      const rawUnitCost = item.unit_cost_at_sale ?? item.purchase_price_at_sale ?? item.unit_cost;
      const unitCost = rawUnitCost == null ? NaN : Number(rawUnitCost);

      if (
        !Number.isFinite(quantity) || quantity <= 0 ||
        !Number.isFinite(unitPrice) || unitPrice < 0 ||
        !Number.isFinite(unitCost) || unitCost < 0
      ) {
        profitDataComplete = false;
        continue;
      }

      grossProfit += (unitPrice - unitCost) * quantity;
      profitLineCount += 1;
    }
  }

  const hasProfit = validSales.length === 0 || (profitDataComplete && profitLineCount > 0);

  return (
    <View className="mb-5">
      <View className="mb-3">
        <Text className="text-lg font-black text-ink">Dashboard des ventes</Text>
        <Text className="text-xs text-muted mt-1">Vue d’ensemble de l’activité du magasin</Text>
      </View>

      <View className="flex-row flex-wrap gap-3">
        <View className="w-[48%] flex-grow bg-white border border-line rounded-2xl p-4">
          <View className="w-10 h-10 rounded-xl bg-blue-50 items-center justify-center mb-3">
            <Text className="text-xl">📦</Text>
          </View>
          <Text className="text-xs text-muted font-bold">Valeur du stock</Text>
          <Text className="text-lg font-black text-ink mt-1">{formatMoney(stockValue)}</Text>
          <Text className="text-[10px] text-muted mt-1">Au prix de vente · {unitsInStock} unité(s)</Text>
        </View>

        <View className="w-[48%] flex-grow bg-white border border-line rounded-2xl p-4">
          <View className="w-10 h-10 rounded-xl bg-green-50 items-center justify-center mb-3">
            <Text className="text-xl">💰</Text>
          </View>
          <Text className="text-xs text-muted font-bold">Somme des ventes</Text>
          <Text className="text-lg font-black text-success mt-1">{formatMoney(salesTotal)}</Text>
          <Text className="text-[10px] text-muted mt-1">Ventes non annulées · {validSales.length} transaction(s)</Text>
        </View>

        <View className="w-full bg-white border border-line rounded-2xl p-4">
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 rounded-xl bg-amber-50 items-center justify-center">
              <Text className="text-xl">📈</Text>
            </View>
            <View className="flex-1">
              <Text className="text-xs text-muted font-bold">Bénéfice brut</Text>
              <Text className="text-lg font-black text-ink mt-1">
                {hasProfit ? formatMoney(grossProfit) : "Données insuffisantes"}
              </Text>
            </View>
          </View>
          <Text className="text-[11px] text-muted mt-3 leading-5">
            {hasProfit
              ? "Calculé à partir du prix et du coût d’achat enregistrés sur chaque article vendu. Les charges du magasin ne sont pas déduites."
              : "Certaines ventes ne contiennent pas le coût d’achat enregistré au moment de la vente. Le bénéfice historique ne peut pas être calculé exactement sans ce coût ; le prix d’achat actuel n’est volontairement pas utilisé comme remplacement."}
          </Text>
        </View>
      </View>
    </View>
  );
}
