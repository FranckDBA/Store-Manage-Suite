// ═════════════════════════════════════════════════════════════// IMPORTS// ═════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from "react";

import {

  Alert,

  AppState,

  FlatList,

  Image,

  Keyboard,

  KeyboardAvoidingView,

  Platform,

  Pressable,

  ScrollView,

  Text,

  TextInput,

  View,

} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import NetInfo from "@react-native-community/netinfo";

import { useSQLiteContext } from "expo-sqlite";

import * as Print from "expo-print";

import * as Sharing from "expo-sharing";

import {

  getProducts,

  ProductRow,

  getSales,

  LocalSale,

  countPendingSales,

  syncProducts,

} from "../src/db/database";

import {

  CartLine,

  addToCart,

  calculateTotal,

  setCartQuantity,

} from "../src/pos/cart";

import { cancelOfflineSale, saveOfflineSale } from "../src/pos/offlineSales";

import logo from "../assets/images/logo.png";

import { syncPendingSales } from "../src/sync/syncService";
import { syncPendingProductCreates } from "../src/sync/productSyncService";

import { API_BASE_URL, fetchProducts } from "../src/api/client";

import { getAuthToken } from "../src/api/authStorage";

import SettingsScreen from "../src/features/settings/SettingsScreen";

import { getStoreSettings, DEFAULT_STORE_SETTINGS, type StoreSettings } from "../src/features/settings/storeSettings";

import SalesDashboard from "../src/features/sales/SalesDashboard";
import ProductsScreen from "../src/features/products/ProductsScreen";

// ═════════════════════════════════════════════════════════════
// TYPES
// ═════════════════════════════════════════════════════════════

type Tab = "Caisse" | "Ventes" | "Stock" | "Sync" | "Config";

type InvoiceLine = { product_id: number; name: string; quantity: number; unit_price: number; line_total: number };

type InvoiceData = { id: string; createdAt: string; lines: InvoiceLine[]; total: number; cashTendered: number; changeAmount: number; status: "paid" | "cancelled"; store: StoreSettings };

function escapeHtml(value: string): string {

  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c] as string));

}

function invoiceHtml(invoice: InvoiceData): string {

  const rows = invoice.lines.map((line) => `

    <div class="item">

      <div class="item-head"><span class="name">${escapeHtml(line.name)}</span><strong class="line-total">${money(line.line_total)}</strong></div>

      <div class="details">${line.quantity} × ${money(line.unit_price)}</div>

    </div>`).join("");

  const date = new Date(invoice.createdAt).toLocaleString("fr-FR", {

    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",

  });

  const store = invoice.store ?? DEFAULT_STORE_SETTINGS;

  const storeLogo = store.logo_data_url

    ? `<img class="store-logo" src="${escapeHtml(store.logo_data_url)}" alt="Logo du magasin" />`

    : `<div class="logo">▤</div>`;

  const storeDetails = [

    store.address, store.city, store.country, store.phone, store.email,

    store.rccm ? `RCCM : ${store.rccm}` : "",

    store.nif ? `NIF : ${store.nif}` : "",

  ].filter(Boolean).map((value) => escapeHtml(value)).join("<br>");

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">

  <title>Ticket ${escapeHtml(invoice.id)}</title>

  <style>

    @page { size: 80mm auto; margin: 3mm; }

    * { box-sizing: border-box; }

    html, body { margin: 0; padding: 0; }

    body { width: 74mm; margin: 0 auto; font-family: "Courier New", monospace; color: #111827; font-size: 10px; line-height: 1.4; }

    .center { text-align: center; }

    .store-logo { max-width: 34mm; max-height: 20mm; object-fit: contain; margin: 1mm 0 3mm; }\n    .logo { width: 34px; height: 34px; border-radius: 11px; background: #111827; color: white; display: inline-flex; align-items: center; justify-content: center; font-size: 18px; margin: 1mm 0 3mm; }

    .store { font-family: Arial, sans-serif; font-size: 15px; font-weight: 900; letter-spacing: .5px; margin: 0 0 5px; }

    .subtitle { font-size: 9px; letter-spacing: 2px; margin-bottom: 8px; }

    .meta { line-height: 1.8; color: #374151; font-size: 9px; }

    .rule { border-top: 1px dashed #9ca3af; margin: 8px 0; }

    .columns, .item-head, .sum { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }

    .columns { font-size: 8px; margin-bottom: 4px; }

    .item { padding: 4px 0 5px; }

    .name { font-family: Arial, sans-serif; font-weight: 700; font-size: 11px; overflow-wrap: anywhere; }

    .line-total { font-size: 11px; white-space: nowrap; text-align: right; }

    .details { color: #6b7280; font-size: 9px; margin-top: 2px; }

    .sum { padding: 3px 0; font-size: 10px; }

    .grand { font-family: Arial, sans-serif; font-size: 13px; font-weight: 900; padding: 5px 0; }

    .grand span:last-child { white-space: nowrap; }

    .thanks { margin-top: 12px; font-family: Arial, sans-serif; font-size: 11px; font-weight: 700; }

    .small { font-size: 8px; color: #6b7280; margin-top: 4px; }

    .cancelled { font-weight: 900; color: #b91c1c; margin-top: 8px; }

    @media print { body { width: 74mm; } }

  </style></head><body>

    <div class="center">

      ${storeLogo}

      <h1 class="store">${escapeHtml(store.store_name || "POS MARKET")}</h1>

      <div class="meta">${storeDetails}</div>

      <div class="subtitle">FACTURE DE VENTE</div>

      <div class="meta">▣ &nbsp; Facture n° ${escapeHtml(invoice.id)}<br>${escapeHtml(date)}</div>

    </div>

    <div class="rule"></div>

    <div class="columns"><span>ARTICLE</span><span>MONTANT</span></div>

    ${rows}

    <div class="rule"></div>

    <div class="sum grand"><span>TOTAL</span><span>${money(invoice.total)}</span></div>

    <div class="sum"><span>Montant reçu</span><span>${money(invoice.cashTendered)}</span></div>

    <div class="sum"><span>Monnaie rendue</span><span>${money(invoice.changeAmount)}</span></div>

    ${invoice.status === "cancelled" ? '<div class="center cancelled">*** VENTE ANNULÉE ***</div>' : ''}

    <div class="rule"></div>

    <div class="center thanks">Merci pour votre achat !</div>

    <div class="center small">Conservez cette facture pour référence.</div>

  </body></html>`;

}

// ═════════════════════════════════════════════════════════════// HELPERS// ═════════════════════════════════════════════════════════════

function productImageUri(image?: string | null): string | null {

  if (!image || !image.trim()) return null;

  const value = image.trim();

  if (/^https?:\/\//i.test(value)) return value;

  const serverBase = API_BASE_URL.replace(/\/api\/?$/, "");

  const path = value.replace(/^\/+/, "").replace(/^storage\//i, "");

  return `${serverBase}/storage/${path}`;

}

function ProductArtwork({ product, large = false }: { product: ProductRow; large?: boolean }) {

  const [imageFailed, setImageFailed] = useState(false);

  const uri = productImageUri(product.image_url);

  useEffect(() => {

    setImageFailed(false);

  }, [uri]);

  return (

    <View

      className={`items-center justify-center overflow-hidden ${

        large

          ? "h-[132px] -mx-3 -mt-3 mb-3 rounded-t-[14px] border-b border-line bg-slate-50"

          : "h-12 w-12 rounded-[10px] border border-line bg-slate-50"

      }`}

    >

      {uri && !imageFailed ? (

        <View className={large ? "h-full w-full p-3" : "h-full w-full p-1"}>

          <Image

            source={{ uri }}

            resizeMode="contain"

            onError={() => setImageFailed(true)}

            className="h-full w-full"

            accessibilityLabel={`Image de ${product.name}`}

          />

        </View>

      ) : (

        <View className="h-full w-full items-center justify-center bg-slate-50">

          <Text className={large ? "text-[48px]" : "text-[25px]"}>

            {productVisual(product)}

          </Text>

          {large ? (

            <Text className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">

              Image indisponible

            </Text>

          ) : null}

        </View>

      )}

    </View>

  );

}

function productVisual(p: ProductRow): string {

  const v = (p.name + " " + (p.category || "")).toLocaleLowerCase();

  if (v.includes("baguette") || v.includes("pain") || v.includes("pât")) return "🥖";

  if (

    v.includes("bière") ||

    v.includes("export") ||

    v.includes("beaufort") ||

    v.includes("cider") ||

    v.includes("tembo") ||

    v.includes("simba")

  )

    return "🍺";

  if (v.includes("chauss") || v.includes("basquette") || v.includes("basket")) return "👟";

  if (v.includes("chips") || v.includes("chipse")) return "🍟";

  if (v.includes("jus") || v.includes("ceres")) return "🧃";

  if (v.includes("biscuit") || v.includes("chocolat") || v.includes("flik")) return "🍫";

  return "🛍️";

}

const money = (n: number) =>

  new Intl.NumberFormat("fr-FR", {

    minimumFractionDigits: 2,

    maximumFractionDigits: 2,

  }).format(n) + " FC";

// ═════════════════════════════════════════════════════════════// COMPOSANTS UI// ═════════════════════════════════════════════════════════════

function Button({

  title,

  onPress,

  disabled = false,

  outline = false,

}: {

  title: string;

  onPress: () => void;

  disabled?: boolean;

  outline?: boolean;

}) {

  return (

    <Pressable

      onPress={onPress}

      disabled={disabled}

      className={`min-h-[47px] rounded-[10px] items-center justify-center px-3.5 ${

        outline ? "bg-white border border-line" : "bg-ink"

      } ${disabled ? "opacity-45" : "opacity-100"}`}

    >

      <Text

        className={`font-extrabold text-sm ${outline ? "text-ink" : "text-white"}`}

      >

        {title}

      </Text>

    </Pressable>

  );

}

function SectionTitle({

  title,

  subtitle,

  right,

}: {

  title: string;

  subtitle?: string;

  right?: string;

}) {

  return (

    <View className="flex-row items-center justify-between mb-3">

      <View>

        <Text className="text-lg font-black text-ink">{title}</Text>

        {!!subtitle && (

          <Text className="text-xs text-muted mt-1">{subtitle}</Text>

        )}

      </View>

      {!!right && (

        <Text className="text-xs text-muted font-bold">{right}</Text>

      )}

    </View>

  );

}

// ═════════════════════════════════════════════════════════════// ÉCRAN PRINCIPAL// ═════════════════════════════════════════════════════════════

export default function Home() {

  const db = useSQLiteContext();

  const autoSyncRunning = useRef(false);

// ── États ──

  const [tab, setTab] = useState<Tab>("Caisse");

  const [products, setProducts] = useState<ProductRow[]>([]);

  const [cart, setCart] = useState<CartLine[]>([]);

  const [search, setSearch] = useState("");

  const [cash, setCash] = useState("");

  const [sales, setSales] = useState<LocalSale[]>([]);

  const [pending, setPending] = useState(0);

  const [checkout, setCheckout] = useState(false);

  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [notice, setNotice] = useState("");

  const [category, setCategory] = useState("Tout");

  const [syncingProducts, setSyncingProducts] = useState(false);

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);

  const [invoiceOpenedFromSales, setInvoiceOpenedFromSales] = useState(false);

  const [invoiceBusy, setInvoiceBusy] = useState(false);

  const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);

// ── Chargement ──

  async function refresh() {

    const [localProducts, localSales, pendingSales] = await Promise.all([

      getProducts(db),

      getSales(db),

      countPendingSales(db),

    ]);

    setProducts(localProducts);

    setSales(localSales);

    setPending(pendingSales);

    const localStoreSettings = await getStoreSettings(db);

    setStoreSettings(localStoreSettings);

  }

async function syncCatalog() {

  if (syncingProducts) return;

  setSyncingProducts(true);

  try {

    const token = await getAuthToken();

    if (!token) {

      setNotice("Reconnecte-toi pour synchroniser les produits.");

      return;

    }

    // Envoyer les créations locales en attente avant de recharger le catalogue.
    // Si la route POST /api/products n'est pas disponible, la file est conservée.
    try {
      const createdCount = await syncPendingProductCreates(db, token);
      if (createdCount > 0) setNotice(`${createdCount} nouveau(x) produit(s) synchronisé(s).`);
    } catch (productSyncError) {
      console.warn("[SYNC CRÉATIONS PRODUITS]", productSyncError instanceof Error ? productSyncError.message : productSyncError);
    }

    const response = await fetchProducts(token);

    const activeProducts = (response.data ?? []).filter(

      (product) => product.is_active,

    );

    await syncProducts(db, activeProducts);

    await refresh();

    setNotice(

      `${activeProducts.length} produit(s) synchronisé(s).`,

    );

  } catch (error) {

    const message =

      error instanceof Error

        ? error.message

        : "Erreur inconnue.";

    console.error("[SYNC PRODUITS]", message);

    setNotice(

      `Synchronisation impossible. Le dernier catalogue local est conservé. ${message}`,

    );

  } finally {

    setSyncingProducts(false);

  }

}

  useEffect(() => {

    void (async () => {

      await refresh();

// Charge automatiquement le catalogue Laravel. Si le réseau est indisponible,
      // le dernier catalogue synchronisé reste disponible dans SQLite.

      await syncCatalog();

    })();

  }, []);

  // Synchronisation automatique des ventes en attente :
  // au retour du réseau, à la reprise de l'application
  // et toutes les 30 secondes lorsque l'app est ouverte.
  useEffect(() => {
    let disposed = false;

    const tryAutoSync = async () => {
      // Verrouiller AVANT tout await pour éviter les appels concurrents.
      if (disposed || autoSyncRunning.current) return;
      autoSyncRunning.current = true;

      try {
        const network = await NetInfo.fetch();
        if (
          disposed ||
          network.isConnected !== true ||
          network.isInternetReachable === false
        ) {
          return;
        }

        const pendingCount = await countPendingSales(db);
        if (disposed || pendingCount === 0) return;

        const token = await getAuthToken();
        if (disposed || !token) return;

        const result = await syncPendingSales(db);

        if (
          !disposed &&
          result.message &&
          !result.message.startsWith("Aucune vente")
        ) {
          setNotice(`Synchronisation automatique : ${result.message}`);
        }

        if (!disposed) await refresh();
      } catch (error) {
        // Une panne réseau ne doit pas interrompre la caisse.
        console.warn(
          "[SYNC AUTO]",
          error instanceof Error ? error.message : error
        );
      } finally {
        autoSyncRunning.current = false;
      }
    };

    const unsubscribeNetwork = NetInfo.addEventListener((state) => {
      if (
        state.isConnected === true &&
        state.isInternetReachable !== false
      ) {
        void tryAutoSync();
      }
    });

    const appStateSubscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state === "active") void tryAutoSync();
      }
    );

    // Vérifie aussi si Laravel redevient disponible alors que le Wi-Fi reste connecté.
    const interval = setInterval(() => {
      if (AppState.currentState === "active") void tryAutoSync();
    }, 30000);

    void tryAutoSync();

    return () => {
      disposed = true;
      unsubscribeNetwork();
      appStateSubscription.remove();
      clearInterval(interval);
    };
  }, [db]);

  useEffect(() => {

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";

    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, (event) => {

      setKeyboardVisible(true);

      setKeyboardHeight(event.endCoordinates?.height ?? 0);

    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {

      setKeyboardVisible(false);

      setKeyboardHeight(0);

    });

    return () => {

      showSubscription.remove();

      hideSubscription.remove();

    };

  }, []);

// ── Données dérivées ──

  const categories = useMemo(

    () => ["Tout", ...Array.from(new Set(products.map((p) => p.category || "Divers")))],

    [products],

  );

  const filtered = useMemo(() => {

    const q = search.trim().toLocaleLowerCase();

    return products.filter(

      (p) =>

        (category === "Tout" || (p.category || "Divers") === category) &&

        (p.name.toLocaleLowerCase().includes(q) ||

          (p.category || "").toLocaleLowerCase().includes(q)),

    );

  }, [products, search, category]);

  const total = calculateTotal(cart);

  const received = Number(cash.replace(",", ".")) || 0;

  const change = Math.max(0, Math.round((received - total) * 100) / 100);

  const count = cart.reduce((n, x) => n + x.quantity, 0);

// ── Actions ──

  function cancelCart() {

    if (!cart.length) return;

    Alert.alert(

      "Annuler le panier ?",

      "Tous les articles ajoutés seront retirés du panier.",

      [

        { text: "Continuer", style: "cancel" },

        { text: "Vider le panier", style: "destructive", onPress: () => setCart([]) },

      ],

    );

  }

  function add(p: ProductRow) {

    const next = addToCart(cart, p);

    if (next === cart) {

      Alert.alert("Stock insuffisant", `Le stock local de ${p.name} est atteint.`);

      return;

    }

    setCart(next);

  }

  async function pay() {

    if (!cart.length) return Alert.alert("Panier vide", "Ajoute des produits.");

    if (received < total)

      return Alert.alert("Montant insuffisant", "Le montant reçu doit couvrir le total.");

    try {

      const soldLines: InvoiceLine[] = cart.map((line) => ({

        product_id: line.product.id,

        name: line.product.name,

        quantity: line.quantity,

        unit_price: line.product.price,

        line_total: Math.round(line.product.price * line.quantity * 100) / 100,

      }));

      const soldTotal = total;

      const receivedAmount = received;

      const changeAmount = change;

      const createdAt = new Date().toISOString();

      const id = await saveOfflineSale(db, cart, received);

      setInvoiceOpenedFromSales(false);

      setInvoice({ id, createdAt, lines: soldLines, total: soldTotal, cashTendered: receivedAmount, changeAmount, status: "paid", store: await getStoreSettings(db) });

      setCart([]);

      setCash("");

      setCheckout(false);

      await refresh();

      setNotice(`Vente ${id} enregistrée localement`);

    } catch (e) {

      Alert.alert("Erreur", e instanceof Error ? e.message : "Échec de l'enregistrement.");

    }

  }

  async function openSaleInvoice(sale: LocalSale) {

    try {

      const row = await db.getFirstAsync<{ payload: string }>(

        "SELECT payload FROM pending_sales WHERE local_id = ?",

        sale.local_id,

      );

      if (!row?.payload) {

        Alert.alert("Facture introuvable", "Les détails de cette vente ne sont pas disponibles localement.");

        return;

      }

      const payload = JSON.parse(row.payload) as {

        items?: Array<{ product_id: number; quantity: number; unit_price_at_sale?: number; product_name_at_sale?: string }>;

        total?: number; cash_tendered?: number; change_amount?: number; created_at?: string;

        cancellation?: unknown;

      };

      const lines: InvoiceLine[] = (payload.items ?? []).map((line) => {

        const unitPrice = Number(line.unit_price_at_sale ?? 0);

        const quantity = Number(line.quantity ?? 0);

        return {

          product_id: Number(line.product_id),

          name: line.product_name_at_sale || `Produit #${line.product_id}`,

          quantity,

          unit_price: unitPrice,

          line_total: Math.round(unitPrice * quantity * 100) / 100,

        };

      });

      if (!lines.length) {

        Alert.alert("Facture indisponible", "Aucun article n’a été trouvé pour cette vente.");

        return;

      }

      setInvoiceOpenedFromSales(true);

      setInvoice({

        id: sale.local_id,

        createdAt: payload.created_at || sale.created_at,

        lines,

        total: Number(payload.total ?? sale.total),

        cashTendered: Number(payload.cash_tendered ?? sale.cash_tendered ?? 0),

        changeAmount: Number(payload.change_amount ?? sale.change_amount ?? 0),

        status: sale.status === "cancelled" || payload.cancellation ? "cancelled" : "paid",

        store: await getStoreSettings(db),

      });

    } catch (error) {

      Alert.alert("Ouverture de la facture impossible", error instanceof Error ? error.message : "Données de vente invalides.");

    }

  }

  async function printInvoice() {

    if (!invoice || invoiceBusy) return;

    setInvoiceBusy(true);

    try { await Print.printAsync({ html: invoiceHtml(invoice) }); }

    catch (error) { Alert.alert("Impression impossible", error instanceof Error ? error.message : "Service d’impression Android indisponible."); }

    finally { setInvoiceBusy(false); }

  }

  async function exportInvoicePdf() {

    if (!invoice || invoiceBusy) return;

    setInvoiceBusy(true);

    try {

      const file = await Print.printToFileAsync({ html: invoiceHtml(invoice), width: 226.77, height: 900 });

      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", dialogTitle: `Facture ${invoice.id}`, UTI: "com.adobe.pdf" });

      else Alert.alert("PDF créé", file.uri);

    } catch (error) { Alert.alert("PDF impossible", error instanceof Error ? error.message : "Une erreur est survenue."); }

    finally { setInvoiceBusy(false); }

  }

  function askCancelInvoice() {

    if (!invoice || invoice.status === "cancelled") return;

    Alert.alert("Annuler cette vente ?", `La vente ${invoice.id} sera annulée et le stock local restauré.`, [

      { text: "Garder la vente", style: "cancel" },

      { text: "Confirmer l’annulation", style: "destructive", onPress: () => {

        void (async () => {

          try {

            await cancelOfflineSale(db, invoice.id, "Annulation par le caissier");

            setInvoice((current) => current ? { ...current, status: "cancelled" } : current);

            await refresh();

            setNotice(`Vente ${invoice.id} annulée localement`);

            Alert.alert("Vente annulée", "Le stock local a été restauré. Le remboursement en espèces doit être effectué au comptoir. L’annulation ne fonctionne que pour une vente encore en attente de synchronisation.");

          } catch (error) { Alert.alert("Annulation impossible", error instanceof Error ? error.message : "Erreur inconnue."); }

        })();

      } },

    ]);

  }

  async function sync() {

    if (autoSyncRunning.current) {

      setNotice("Synchronisation déjà en cours. Réessaie dans un instant.");

      return;

    }

    autoSyncRunning.current = true;

    try {

      const r = await syncPendingSales(db);

      setNotice(r.message);

      await refresh();

      Alert.alert("Synchronisation", r.message);

    } finally {

      autoSyncRunning.current = false;

    }

  }

// ── Onglets ──

  const tabs: { id: Tab; icon: string; label: string }[] = [

    { id: "Caisse", icon: "🧾", label: "Caisse" },

    { id: "Ventes", icon: "💰", label: "Ventes" },

    { id: "Stock", icon: "📦", label: "Produits" },

    { id: "Sync", icon: "🔄", label: "Sync" },

    { id: "Config", icon: "⚙️", label: "Config" },

  ];

// ═══════════════════════════════════════════════════════════// RENDU// ═══════════════════════════════════════════════════════════

  return (

    <SafeAreaView edges={["top", "right", "bottom", "left"]} className="flex-1 bg-bg">

      {/* ─────────── HEADER ─────────── */}

      <View className="bg-white px-4 pt-3 pb-3 border-b border-line">

        <View className="flex-row items-center justify-between">

          <View className="flex-row items-center gap-2.5">

           <View className="w-[38px] h-[38px] rounded-[11px] overflow-hidden">

              <Image

                source={storeSettings.logo_data_url ? { uri: storeSettings.logo_data_url } : logo}

                resizeMode="contain"

                className="w-full h-full"

                accessibilityLabel="Logo du magasin"

              />

            </View>

            <View>

              <Text className="text-[11px] font-black tracking-[1.3px] text-muted">

                STORE MANAGER

              </Text>

              <Text className="text-[19px] font-black text-ink mt-0.5">

                Point de vente

              </Text>

            </View>

          </View>

          <View className="bg-successpale px-2.5 py-2 rounded-[9px] flex-row items-center gap-1.5">

            <View className="w-[7px] h-[7px] rounded bg-success" />

            <Text className="text-[11px] text-success font-extrabold">LOCAL</Text>

          </View>

        </View>

        <View className="flex-row items-center justify-between mt-2.5">

          <Text numberOfLines={1} className="text-muted text-[11px] flex-1">

            {notice}

          </Text>

          <Text

            className={`text-[11px] font-extrabold ${

              pending ? "text-warn" : "text-muted"

            }`}

          >

            {pending} vente(s) en attente

          </Text>

        </View>

      </View>

      {/* ─────────── CONTENU ONGLETS ─────────── */}

      <View className="flex-1">

        {/* ══════ ONGLET CAISSE ══════ */}

        {tab === "Caisse" && (

          <View className="flex-1">

            {/* Barre de recherche */}

            <View className="px-3 pt-3 pb-2">

              <View className="bg-white rounded-[11px] border border-line flex-row items-center px-3">

                <Text className="text-lg text-muted mr-2">⌕</Text>

                <TextInput

                  value={search}

                  onChangeText={setSearch}

                  placeholder="Rechercher un produit ou une catégorie…"

                  placeholderTextColor="#A3A3A3"

                  className="flex-1 py-3 text-ink text-[13px]"

                />

                {!!search && (

                  <Pressable onPress={() => setSearch("")}>

                    <Text className="text-brand font-bold">×</Text>

                  </Pressable>

                )}

              </View>

            </View>

            {/* Titre catalogue */}

            <View className="px-3 flex-row items-center justify-between mb-2">

              <Text className="text-base font-black text-ink">

                Catalogue des produits

              </Text>

              <Text className="text-[11px] text-muted">

                {filtered.length} résultat(s)

              </Text>

            </View>

            {/* Catégories */}

            <ScrollView

              horizontal

              showsHorizontalScrollIndicator={false}

              className="max-h-[42px] flex-grow-0"

              contentContainerClassName="px-3 gap-2 pb-2"

            >

              {categories.map((c) => (

                <Pressable

                  key={c}

                  onPress={() => setCategory(c)}

                  className={`px-3 py-2 rounded-[20px] border ${

                    category === c

                      ? "bg-ink border-ink"

                      : "bg-white border-line"

                  }`}

                >

                  <Text

                    className={`text-[11px] font-extrabold ${

                      category === c ? "text-white" : "text-muted"

                    }`}

                  >

                    {c}

                  </Text>

                </Pressable>

              ))}

            </ScrollView>

            {/* Grille produits */}

            <View className="flex-1 px-3">

              <FlatList

                data={filtered}

                keyExtractor={(p) => String(p.id)}

                numColumns={2}

                columnWrapperClassName="gap-2.5"

                contentContainerClassName="gap-2.5 pb-3"

                renderItem={({ item }) => (

                  <Pressable

                    onPress={() => add(item)}

                    className="flex-1 overflow-hidden bg-white rounded-[16px] border border-line p-3 min-h-[238px] justify-start"

                  >

                    <ProductArtwork product={item} large />

                    <Text

                      numberOfLines={2}

                      className="text-[13px] font-extrabold text-ink mt-1 min-h-[36px]"

                    >

                      {item.name}

                    </Text>

                    <Text className="text-[15px] font-black text-ink mt-2">

                      {money(item.price)}

                    </Text>

                    <Text

                      className={`text-[10px] mt-1 ${

                        item.stock > 0 ? "text-muted" : "text-danger"

                      }`}

                    >

                      Stock : {item.stock}

                    </Text>

                  </Pressable>

                )}

                ListEmptyComponent={

                  <View className="p-5 bg-white rounded-xl">

                    <Text className="text-center text-muted">

                      Aucun produit trouvé.

                    </Text>

                  </View>

                }

              />

            </View>

            {/* Panier */}

            <View className="bg-white border-t border-line px-4 pt-3 pb-3">

              <View className="flex-row items-center justify-between">

                <View>

                  <Text className="text-base font-black text-ink">Panier</Text>

                  <Text className="text-[11px] text-muted mt-0.5">

                    {count} article(s)

                  </Text>

                </View>

                <Text className="text-[22px] font-black text-ink">

                  {money(total)}

                </Text>

              </View>

              {!!cart.length ? (

                <ScrollView

                  showsVerticalScrollIndicator={cart.length > 2}

                  className="mt-3 max-h-[190px]"

                  nestedScrollEnabled

                  keyboardShouldPersistTaps="handled"

                >

                  <View className="gap-2">

                    {cart.map((l) => (

                      <View

                        key={l.product.id}

                        className="flex-row items-center rounded-[12px] border border-line bg-bg p-2"

                      >

                        <ProductArtwork product={l.product} />

                        <View className="flex-1 min-w-0 ml-2.5 mr-2">

                          <Text numberOfLines={2} className="text-[12px] font-extrabold text-ink">

                            {l.product.name}

                          </Text>

                          <Text className="text-[11px] text-muted mt-0.5">

                            {money(l.product.price)} × {l.quantity}

                          </Text>

                          <Text className="text-[12px] font-black text-ink mt-0.5">

                            {money(l.product.price * l.quantity)}

                          </Text>

                        </View>

                        <View className="items-center justify-center">

                          <Pressable

                            accessibilityRole="button"

                            accessibilityLabel={`Retirer ${l.product.name} du panier`}

                            onPress={() => setCart((v) => setCartQuantity(v, l.product.id, 0))}

                            hitSlop={8}

                            className="self-end px-2 py-1 mb-1"

                          >

                            <Text className="text-danger text-[15px] font-black">×</Text>

                          </Pressable>

                          <View className="flex-row items-center rounded-[9px] border border-line bg-white">

                            <Pressable

                              accessibilityRole="button"

                              accessibilityLabel={`Diminuer la quantité de ${l.product.name}`}

                              onPress={() => setCart((v) => setCartQuantity(v, l.product.id, l.quantity - 1))}

                              className="w-8 h-8 items-center justify-center"

                            >

                              <Text className="text-danger text-base font-black">−</Text>

                            </Pressable>

                            <Text className="min-w-[22px] text-center text-[12px] font-black text-ink">

                              {l.quantity}

                            </Text>

                            <Pressable

                              accessibilityRole="button"

                              accessibilityLabel={`Augmenter la quantité de ${l.product.name}`}

                              onPress={() => setCart((v) => setCartQuantity(v, l.product.id, l.quantity + 1))}

                              className="w-8 h-8 items-center justify-center"

                            >

                              <Text className="text-success text-base font-black">+</Text>

                            </Pressable>

                          </View>

                        </View>

                      </View>

                    ))}

                  </View>

                </ScrollView>

              ) : (

                <View className="mt-3 rounded-[12px] border border-dashed border-line bg-bg px-3 py-4 items-center">

                  <Text className="text-[22px]">🛒</Text>

                  <Text className="text-[12px] font-bold text-ink mt-1">Ton panier est vide</Text>

                  <Text className="text-[11px] text-muted text-center mt-0.5">

                    Appuie sur un produit pour l’ajouter ici.

                  </Text>

                </View>

              )}

              <View className="flex-row gap-2 mt-3">

                <Pressable

                  accessibilityRole="button"

                  accessibilityLabel="Annuler et vider le panier"

                  disabled={!cart.length}

                  onPress={cancelCart}

                  className={`min-h-[50px] px-4 rounded-[12px] border items-center justify-center ${

                    cart.length ? "bg-white border-line" : "bg-gray-100 border-line"

                  }`}

                >

                  <Text className={`font-extrabold text-sm ${

                    cart.length ? "text-danger" : "text-muted"

                  }`}>

                    Vider

                  </Text>

                </Pressable>

                <Pressable

                  accessibilityRole="button"

                  disabled={!cart.length}

                  onPress={() => {

                    setCash("");

                    setCheckout(true);

                  }}

                  className={`flex-1 min-h-[50px] rounded-[12px] items-center justify-center ${

                    cart.length ? "bg-ink" : "bg-gray-400"

                  }`}

                >

                  <Text className="text-white font-black text-sm">

                    {cart.length ? `Encaisser · ${money(total)}` : "Ajoute des produits"}

                  </Text>

                </Pressable>

              </View>

            </View>

          </View>

        )}

        {/* ══════ ONGLET VENTES ══════ */}

        {tab === "Ventes" && (

          <View className="flex-1 p-3.5">

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>

              <SalesDashboard products={products} sales={sales} formatMoney={money} />

              <SectionTitle

              title="Historique des ventes"

              subtitle="Transactions enregistrées sur le terminal"

              right={`${sales.length} vente(s)`}

            />

            <FlatList

              scrollEnabled={false}

              data={sales}

              keyExtractor={(s) => s.local_id}

              contentContainerClassName="gap-2.5 pb-5"

              renderItem={({ item }) => (

                <Pressable

                  onPress={() => void openSaleInvoice(item)}

                  accessibilityRole="button"

                  accessibilityLabel={`Ouvrir la facture de la vente ${item.local_id}`}

                  className="bg-white border border-line rounded-xl p-3.5"

                >

                  <View className="flex-row justify-between gap-2">

                    <Text className="font-black text-ink flex-1">

                      Vente #{item.local_id.slice(-7).toUpperCase()}

                    </Text>

                    <Text className={`font-black ${item.status === "cancelled" ? "text-danger" : "text-success"}`}>

                      {money(item.total)}

                    </Text>

                  </View>

                  <Text className="text-[11px] font-bold text-ink mt-1.5">{storeSettings.store_name || "POS MARKET"}</Text>

                  <Text className="text-[11px] text-muted mt-1">

                    {new Date(item.created_at).toLocaleString("fr-FR")}

                  </Text>

                  <View className={`self-start mt-2 rounded-[7px] px-2 py-1 ${item.status === "synced" ? "bg-successpale" : item.status === "cancelled" ? "bg-red-50" : "bg-warnpale"}`}>

                    <Text className={`text-[10px] font-black ${item.status === "synced" ? "text-success" : item.status === "cancelled" ? "text-danger" : "text-warn"}`}>

                      {item.status === "synced" ? "Synchronisée" : item.status === "cancelled" ? "Annulée" : "En attente de synchronisation"}

                    </Text>

                  </View>

                  <Text className="text-[11px] text-brand font-extrabold mt-3">Appuyer pour afficher la facture ›</Text>

                </Pressable>

              )}

              ListEmptyComponent={

                <Text className="text-muted">Aucune vente locale pour le moment.</Text>

              }

            />

            </ScrollView>

          </View>

        )}

        {/* ══════ ONGLET STOCK ══════ */}

        {tab === "Stock" && (
          <ProductsScreen
            products={products}
            onRefresh={refresh}
            onSync={() => void syncCatalog()}
            syncing={syncingProducts}
          />
        )}

        {/* ══════ ONGLET SYNC ══════ */}

        {tab === "Sync" && (

          <View className="flex-1 p-3.5 gap-3">

            <View className="bg-white rounded-[14px] border border-line p-4">

              <Text className="text-[11px] font-black tracking-[1.3px] text-muted">

                SYNCHRONISATION

              </Text>

              <Text className="text-[28px] font-black text-ink mt-2">

                {pending} vente(s)

              </Text>

              <Text className="text-[13px] text-muted leading-5 mt-1">

                en attente d'envoi vers le serveur Laravel.

              </Text>

              <View className="h-px bg-line my-3.5" />

              <Text className="text-[13px] text-ink leading-5">

                Les ventes sont enregistrées localement et envoyées automatiquement lorsque le réseau et le serveur Laravel sont disponibles. Tu peux également lancer une synchronisation manuelle. Les ventes en attente restent conservées sur cet appareil.

              </Text>

            </View>

            <Button

              title={

                syncingProducts

                  ? "Synchronisation des produits..."

                  : "Synchroniser les produits Laravel"

              }

              onPress={() => void syncCatalog()}

              disabled={syncingProducts}

            />

            <Button title="Vérifier la synchronisation" onPress={() => void sync()} />

            <Button

              title="Actualiser les données"

              outline

              onPress={() => void refresh()}

            />

          </View>

        )}

        {tab === "Config" && <SettingsScreen db={db} />}

      </View>

      {/* ─────────── BARRE DE NAVIGATION BASSE ─────────── */}

      <View className="flex-row bg-white border-t border-line">

        {tabs.map((t) => (

          <Pressable

            key={t.id}

            onPress={() => setTab(t.id)}

            className="flex-1 items-center py-2.5 gap-1"

          >

            <Text

              className={`text-[17px] ${

                tab === t.id ? "text-ink" : "text-muted"

              }`}

            >

              {t.icon}

            </Text>

            <Text

              className={`text-[10px] font-extrabold ${

                tab === t.id ? "text-ink" : "text-muted"

              }`}

            >

              {t.label}

            </Text>

          </Pressable>

        ))}

      </View>

        {/* ─────────── MODAL ENCAISSEMENT ─────────── */}

        {checkout && (

          <View

            className="absolute inset-0 bg-black/45"

            style={{ bottom: keyboardVisible ? keyboardHeight : 0 }}

          >

            <KeyboardAvoidingView

              className="flex-1 justify-end"

              behavior={Platform.OS === "ios" ? "padding" : undefined}

            >

              <View

                className="bg-white rounded-t-[24px] overflow-hidden"

                style={{ maxHeight: keyboardVisible ? "98%" : "90%" }}

              >

                <View className="px-5 pt-3 pb-4">

                  <View className="w-10 h-1 rounded-full bg-gray-200 self-center mb-3" />

                  <View className="flex-row items-start justify-between">

                    <View className="flex-1">

                      <Text className="text-[22px] font-black text-ink">Encaissement</Text>

                      <Text className="text-xs text-muted mt-1">

                        Paiement en espèces

                      </Text>

                    </View>

                    <Pressable

                      accessibilityRole="button"

                      accessibilityLabel="Fermer l'encaissement"

                      onPress={() => {

                        Keyboard.dismiss();

                        setKeyboardVisible(false);

                        setKeyboardHeight(0);

                        setCheckout(false);

                      }}

                      className="w-9 h-9 rounded-full bg-bg items-center justify-center"

                    >

                      <Text className="text-lg font-bold text-muted">×</Text>

                    </Pressable>

                  </View>

                  {/* Montants fixes : ils restent visibles pendant la saisie. */}

                  <View className="flex-row gap-2 mt-4">

                    <View className="flex-1 rounded-[14px] bg-bg border border-line p-3">

                      <Text className="text-[10px] font-extrabold tracking-wide text-muted">

                        TOTAL À PAYER

                      </Text>

                      <Text numberOfLines={1} adjustsFontSizeToFit className="text-[20px] font-black text-ink mt-1">

                        {money(total)}

                      </Text>

                    </View>

                    <View className={`flex-1 rounded-[14px] border p-3 ${

                      received >= total ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"

                    }`}>

                      <Text className="text-[10px] font-extrabold tracking-wide text-muted">

                        MONNAIE À RENDRE

                      </Text>

                      <Text numberOfLines={1} adjustsFontSizeToFit className={`text-[20px] font-black mt-1 ${

                        received >= total ? "text-success" : "text-ink"

                      }`}>

                        {money(change)}

                      </Text>

                    </View>

                  </View>

                  <Text className="font-extrabold text-ink mt-4 mb-2">Montant reçu</Text>

                  <TextInput

                    value={cash}

                    onChangeText={setCash}

                    keyboardType="decimal-pad"

                    placeholder="0,00"

                    autoFocus

                    selectTextOnFocus

                    accessibilityLabel="Montant reçu"

                    accessibilityHint="Saisis le montant donné par le client"

                    className="border-2 border-line rounded-[13px] px-4 py-3 text-[23px] font-black text-ink"

                  />

                  <View className="flex-row gap-2 mt-3">

                    <Pressable

                      accessibilityRole="button"

                      onPress={() => {

                        Keyboard.dismiss();

                        setKeyboardVisible(false);

                        setKeyboardHeight(0);

                        setCheckout(false);

                      }}

                      className="flex-1 min-h-[48px] rounded-[12px] border border-line bg-white items-center justify-center"

                    >

                      <Text className="font-extrabold text-ink">Annuler</Text>

                    </Pressable>

                    <Pressable

                      accessibilityRole="button"

                      disabled={!cart.length || received < total}

                      onPress={() => {

                        Keyboard.dismiss();

                        setKeyboardVisible(false);

                        setKeyboardHeight(0);

                        void pay();

                      }}

                      className={`flex-[1.5] min-h-[48px] rounded-[12px] items-center justify-center ${

                        cart.length && received >= total ? "bg-ink" : "bg-gray-300"

                      }`}

                    >

                      <Text className="font-black text-white">Confirmer la vente</Text>

                    </Pressable>

                  </View>

                </View>

              </View>

            </KeyboardAvoidingView>

          </View>

        )}

      {invoice && (

        <View className="absolute inset-0 bg-black/50 justify-end">

          <Pressable accessibilityRole="button" accessibilityLabel="Fermer la facture" onPress={() => setInvoice(null)} className="flex-1" />

          <View className="bg-white rounded-t-[24px] px-5 pt-4 pb-6 max-h-[88%]">

            <View className="flex-row items-center justify-between mb-4">

              <View className="flex-1"><Text className="text-[22px] font-black text-ink">Facture de vente</Text><Text className="text-xs text-muted mt-1">Réf. {invoice.id}</Text></View>

              <Pressable onPress={() => setInvoice(null)} className="p-2"><Text className="text-2xl text-muted">×</Text></Pressable>

            </View>

            <ScrollView showsVerticalScrollIndicator={false}>

              <View className="self-center w-full max-w-[360px] border border-gray-200 bg-white px-4 py-4 mb-3">

                <View className="items-center border-b border-dashed border-gray-300 pb-3">

                  {invoice.store.logo_data_url ? <Image source={{ uri: invoice.store.logo_data_url }} resizeMode="contain" className="w-14 h-14 mb-2" /> : <View className="w-9 h-9 rounded-xl bg-ink items-center justify-center mb-2"><Text className="text-white text-lg">▤</Text></View>}

                  <Text className="text-[17px] font-black tracking-wide text-ink text-center">{invoice.store.store_name || "POS MARKET"}</Text>

                  {[invoice.store.address, invoice.store.city, invoice.store.country, invoice.store.phone, invoice.store.email, invoice.store.rccm ? `RCCM : ${invoice.store.rccm}` : "", invoice.store.nif ? `NIF : ${invoice.store.nif}` : ""].filter(Boolean).map((detail, i) => <Text key={i} className="text-[10px] text-muted mt-0.5 text-center">{detail}</Text>)}

                  <Text className="text-[9px] tracking-[2px] text-muted mt-2">FACTURE DE VENTE</Text>

                  <Text className="text-[10px] text-muted mt-3">Facture n° {invoice.id}</Text>

                  <Text className="text-[10px] text-muted mt-1">{new Date(invoice.createdAt).toLocaleString("fr-FR")}</Text>

                  {invoice.status === "cancelled" && <Text className="font-black text-danger mt-2">VENTE ANNULÉE</Text>}

                </View>

                <View className="flex-row justify-between py-2 border-b border-dashed border-gray-300"><Text className="text-[9px] font-bold text-muted">ARTICLE</Text><Text className="text-[9px] font-bold text-muted">MONTANT</Text></View>

                {invoice.lines.map((line, index) => (

                  <View key={`${line.product_id}-${index}`} className="py-2">

                    <View className="flex-row justify-between items-start gap-2"><Text className="flex-1 text-[12px] font-bold text-ink">{line.name}</Text><Text className="text-[11px] font-black text-ink">{money(line.line_total)}</Text></View>

                    <Text className="text-[10px] text-muted mt-1">{line.quantity} × {money(line.unit_price)}</Text>

                  </View>

                ))}

                <View className="border-t border-dashed border-gray-300 pt-2 mt-1">

                  <View className="flex-row justify-between py-1"><Text className="font-black text-ink">TOTAL</Text><Text className="font-black text-ink">{money(invoice.total)}</Text></View>

                  <View className="flex-row justify-between py-1"><Text className="text-[11px] text-muted">Montant reçu</Text><Text className="text-[11px] text-ink">{money(invoice.cashTendered)}</Text></View>

                  <View className="flex-row justify-between py-1"><Text className="text-[11px] text-muted">Monnaie rendue</Text><Text className="text-[11px] text-ink">{money(invoice.changeAmount)}</Text></View>

                </View>

                <View className="border-t border-dashed border-gray-300 mt-2 pt-3 items-center"><Text className="text-[12px] font-bold text-ink">Merci pour votre achat !</Text><Text className="text-[9px] text-muted mt-1">Conservez cette facture pour référence.</Text></View>

              </View>

              <Pressable disabled={invoiceBusy} onPress={() => void printInvoice()} className={`min-h-[49px] mt-4 rounded-xl items-center justify-center ${invoiceBusy ? "bg-gray-400" : "bg-ink"}`}><Text className="font-black text-white">{invoiceBusy ? "Préparation…" : "Imprimer la facture"}</Text></Pressable>

              <Pressable disabled={invoiceBusy} onPress={() => void exportInvoicePdf()} className="min-h-[49px] mt-2 rounded-xl border border-line items-center justify-center"><Text className="font-extrabold text-ink">Créer / partager le ticket PDF</Text></Pressable>

              {invoice.status === "paid" && !invoiceOpenedFromSales && <Pressable onPress={askCancelInvoice} className="min-h-[49px] mt-2 rounded-xl border border-red-200 bg-red-50 items-center justify-center"><Text className="font-black text-red-700">Annuler la vente</Text></Pressable>}

            </ScrollView>

          </View>

        </View>

      )}

    </SafeAreaView>

  );

}
