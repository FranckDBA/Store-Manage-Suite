import { useState } from "react";
import { Alert, FlatList, Image, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSQLiteContext } from "expo-sqlite";
import type { ProductRow } from "../../db/database";
import ProductArtwork from "../../components/ProductArtwork";
import { confirmCurrentPassword } from "../../api/client";
import { getAuthToken } from "../../api/authStorage";
import { createProduct } from "../../api/client";
import NetInfo from "@react-native-community/netinfo";

type Movement = {
  id: number; product_id: number; product_name: string; movement_type: "entry" | "exit" | "adjustment";
  quantity: number; delta: number; reason: string; created_at: string; sync_status: string;
};
type Props = { products: ProductRow[]; onRefresh: () => Promise<void>; onSync: () => void; syncing: boolean };
type Mode = "entry" | "exit" | "adjustment" | "edit" | "history";
const money = (n: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " FC";

export default function ProductsScreen({ products, onRefresh, onSync, syncing }: Props) {
  const db = useSQLiteContext();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out" | "available">("all");
  const [selected, setSelected] = useState<ProductRow | null>(null);
  const [mode, setMode] = useState<Mode>("entry");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [history, setHistory] = useState<Movement[]>([]);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newPurchasePrice, setNewPurchasePrice] = useState("");
  const [newStock, setNewStock] = useState("0");
  const [newDescription, setNewDescription] = useState("");
  const [newImageUri, setNewImageUri] = useState<string | null>(null);
  const [newActive, setNewActive] = useState(true);
  const [showCategoryChoices, setShowCategoryChoices] = useState(false);
  const [creating, setCreating] = useState(false);

  async function unlockWithLaravelPassword() {
    setPasswordError("");
    if (!password) {
      setPasswordError("Saisis le mot de passe de ton compte.");
      return;
    }
    setSavingPassword(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        setPasswordError("Session expirée. Reconnecte-toi à l'application.");
        return;
      }
      await confirmCurrentPassword(token, password);
      setUnlocked(true);
      setPassword("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Vérification impossible.";
      setPasswordError(
        message.includes("404")
          ? "La route Laravel POST /api/confirm-password n'existe pas encore. Ajoute-la avec le code fourni dans README-PROTECTION-PRODUITS.md."
          : message.includes("401") || message.toLowerCase().includes("incorrect") || message.toLowerCase().includes("invalid")
            ? "Mot de passe incorrect ou session expirée."
            : message
      );
    } finally {
      setSavingPassword(false);
    }
  }

  if (!unlocked) {
    return (
      <View className="flex-1 bg-bg justify-center px-6">
        <View className="bg-white border border-line rounded-2xl p-5 gap-3">
          <Text className="text-xl font-black text-ink">🔒 Onglet Produits protégé</Text>
          <Text className="text-sm text-muted">Confirme le mot de passe de ton compte  pour accéder au stock.</Text>
          <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Saisie ton mot de passe" autoCapitalize="none" autoCorrect={false} autoComplete="password" className="border border-line rounded-xl px-3 py-3 text-ink" onSubmitEditing={() => void unlockWithLaravelPassword()} />
          {!!passwordError && <Text className="text-sm text-danger">{passwordError}</Text>}
          <Pressable onPress={() => void unlockWithLaravelPassword()} disabled={savingPassword} className={`rounded-xl py-3.5 items-center ${savingPassword ? "bg-gray-400" : "bg-ink"}`}><Text className="text-white font-black">{savingPassword ? "Vérification…" : "Déverrouiller"}</Text></Pressable>
         
        </View>
      </View>
    );
  }

  const q = query.trim().toLocaleLowerCase();
  const filtered = products.filter(p => {
    const matchesQuery = p.name.toLocaleLowerCase().includes(q) || (p.category ?? "").toLocaleLowerCase().includes(q) || String(p.id).includes(q);
    const matchesFilter = filter === "all" || (filter === "low" && p.stock > 0 && p.stock <= 5) || (filter === "out" && p.stock <= 0) || (filter === "available" && p.stock > 5);
    return matchesQuery && matchesFilter;
  });

  const lowCount = products.filter(p => p.stock > 0 && p.stock <= 5).length;
  const outCount = products.filter(p => p.stock <= 0).length;
  const stockValue = products.reduce((sum, p) => sum + p.stock * p.purchase_price, 0);

  function openMovement(product: ProductRow, nextMode: Mode) {
    setSelected(product); setMode(nextMode); setQuantity("1"); setReason("");
    setName(product.name); setPrice(String(product.price)); setPurchasePrice(String(product.purchase_price));
  }

  async function saveMovement() {
    if (!selected) return;
    const n = Number(quantity.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) { Alert.alert("Quantité invalide", "Saisis une quantité supérieure à zéro."); return; }
    const delta = mode === "entry" ? n : mode === "exit" ? -n : n - selected.stock;
    if (selected.stock + delta < 0) { Alert.alert("Stock insuffisant", "La sortie dépasserait le stock disponible."); return; }
    try {
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `INSERT INTO stock_movements (product_id, product_name, movement_type, quantity, delta, reason, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
          selected.id, selected.name, mode, n, delta, reason.trim(),
        );
        await db.runAsync("UPDATE local_products SET stock = stock + ? WHERE id = ?", delta, selected.id);
      });
      setSelected(null); await onRefresh();
      Alert.alert("Mouvement enregistré", "Le stock local a été mis à jour. Ce mouvement reste en attente tant que l'API Laravel de mouvements de stock n'est pas disponible.");
    } catch (e) { Alert.alert("Erreur", e instanceof Error ? e.message : "Impossible d'enregistrer le mouvement."); }
  }

  async function saveEdit() {
    if (!selected) return;
    const nextPrice = Number(price.replace(",", "."));
    const nextPurchase = Number(purchasePrice.replace(",", "."));
    if (!name.trim() || !Number.isFinite(nextPrice) || nextPrice < 0 || !Number.isFinite(nextPurchase) || nextPurchase < 0) {
      Alert.alert("Informations invalides", "Vérifie le nom, le prix de vente et le prix d'achat."); return;
    }
    try {
      await db.withTransactionAsync(async () => {
        await db.runAsync("UPDATE local_products SET name=?, price=?, purchase_price=? WHERE id=?", name.trim(), nextPrice, nextPurchase, selected.id);
        await db.runAsync(
          `INSERT INTO pending_product_edits (product_id, name, price, purchase_price, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'))
           ON CONFLICT(product_id) DO UPDATE SET name=excluded.name, price=excluded.price, purchase_price=excluded.purchase_price, updated_at=datetime('now')`,
          selected.id, name.trim(), nextPrice, nextPurchase,
        );
      });
      setSelected(null); await onRefresh();
      Alert.alert("Modification enregistrée", "La modification est conservée localement. La route Laravel actuelle permet de lire les produits, mais pas encore de les modifier sur le serveur.");
    } catch (e) { Alert.alert("Erreur", e instanceof Error ? e.message : "Impossible de modifier le produit."); }
  }


  async function chooseProductImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Autorisation nécessaire", "Autorise l’accès aux photos pour choisir l’image du produit.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert("Image trop volumineuse", "Choisis une image de 5 Mo maximum.");
        return;
      }
      setNewImageUri(asset.uri);
    }
  }

  async function saveNewProduct() {
    const productName = newName.trim();
    const salePrice = Number(newPrice.replace(",", "."));
    const buyPrice = Number(newPurchasePrice.replace(",", ".") || 0);
    const initialStock = Number(newStock.replace(",", ".") || 0);
    if (!productName || !Number.isFinite(salePrice) || salePrice < 0 || !Number.isFinite(buyPrice) || buyPrice < 0 || !Number.isInteger(initialStock) || initialStock < 0) {
      Alert.alert("Informations invalides", "Saisis un nom, des prix valides et un stock entier positif ou nul."); return;
    }
    setCreating(true);
    try {
      const network = await NetInfo.fetch();
      const token = await getAuthToken();
      if (network.isConnected && network.isInternetReachable !== false && token) {
        try {
          await createProduct(token, { name: productName, description: newDescription.trim() || null, price: salePrice, purchase_price: buyPrice, stock: initialStock, category: newCategory.trim() || null, is_active: newActive, image_uri: newImageUri });
          setCreateVisible(false); resetCreateForm(); await onRefresh(); onSync();
          Alert.alert("Produit créé", "Le produit a été envoyé à Laravel.");
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Erreur API";
          // N'utiliser la file hors ligne que si le backend n'a pas encore de route de création.
          if (!/404|405|route|not found/i.test(message)) throw error;
        }
      }
      const min = await db.getFirstAsync<{id:number}>("SELECT MIN(id) AS id FROM local_products WHERE id < 0");
      const localId = Math.min(-1, (min?.id ?? 0) - 1);
      await db.withTransactionAsync(async () => {
        await db.runAsync("INSERT INTO pending_product_creates (local_id,name,price,purchase_price,stock,category,description,image_uri,is_active) VALUES (?,?,?,?,?,?,?,?,?)", localId, productName, salePrice, buyPrice, initialStock, newCategory.trim() || null, newDescription.trim() || null, newImageUri, newActive ? 1 : 0);
        await db.runAsync("INSERT INTO local_products (id,name,price,purchase_price,stock,category,updated_at,image_url,description,is_active) VALUES (?,?,?,?,?,?,datetime('now'),?,?,?)", localId, productName, salePrice, buyPrice, initialStock, newCategory.trim() || null, newImageUri, newDescription.trim() || null, newActive ? 1 : 0);
      });
      setCreateVisible(false); resetCreateForm(); await onRefresh();
      Alert.alert("Produit enregistré hors ligne", "Le produit est conservé sur cet appareil. Pour le synchroniser, ajoute la route POST /api/products décrite dans README-SYNCHRONISATION-PRODUITS.md.");
    } catch (error) {
      Alert.alert("Création impossible", error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally { setCreating(false); }
  }

  function resetCreateForm() {
    setNewName(""); setNewCategory(""); setNewPrice(""); setNewPurchasePrice(""); setNewStock("0"); setNewDescription(""); setNewImageUri(null); setNewActive(true); setShowCategoryChoices(false);
  }

  async function showHistory(product: ProductRow) {
    setSelected(product); setMode("history");
    const rows = await db.getAllAsync<Movement>("SELECT * FROM stock_movements WHERE product_id=? ORDER BY created_at DESC, id DESC LIMIT 100", product.id);
    setHistory(rows);
  }

  const chip = (id: typeof filter, label: string) => (
    <Pressable key={id} onPress={() => setFilter(id)} className={`px-2.5 py-1.5 rounded-full border ${filter === id ? "bg-ink border-ink" : "bg-white border-line"}`}>
      <Text className={`text-[10px] font-bold ${filter === id ? "text-white" : "text-muted"}`}>{label}</Text>
    </Pressable>
  );

  return (
    <View className="flex-1 p-3 gap-2.5">
      <View className="flex-row gap-2">
        <View className="flex-1 rounded-xl bg-white border border-line p-3"><Text className="text-[10px] text-muted font-bold">PRODUITS</Text><Text className="text-xl font-black text-ink">{products.length}</Text></View>
        <View className="flex-1 rounded-xl bg-amber-50 border border-amber-100 p-3"><Text className="text-[10px] text-amber-800 font-bold">STOCK FAIBLE</Text><Text className="text-xl font-black text-amber-800">{lowCount}</Text></View>
        <View className="flex-1 rounded-xl bg-red-50 border border-red-100 p-3"><Text className="text-[10px] text-red-700 font-bold">RUPTURE</Text><Text className="text-xl font-black text-red-700">{outCount}</Text></View>
      </View>
      <View className="rounded-xl bg-white border border-line px-3 py-2.5 flex-row items-center">
        <Text className="text-muted mr-2">⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder="Nom, catégorie ou ID…" placeholderTextColor="#9CA3AF" className="flex-1 text-[13px] text-ink py-1" />
        {!!query && <Pressable onPress={() => setQuery("")}><Text className="text-brand font-bold">×</Text></Pressable>}
      </View>
      <ScrollView horizontal style={{ height: 40, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", gap: 6, paddingRight: 2 }} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {chip("all", "Tous")}{chip("low", "Stock faible")}{chip("out", "Rupture")}{chip("available", "Disponibles")}
      </ScrollView>
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1"><Text className="text-base font-black text-ink">Inventaire</Text><Text className="text-[10px] text-muted">Valeur au prix d'achat : {money(stockValue)}</Text></View>
        <Pressable onPress={() => { resetCreateForm(); setCreateVisible(true); }} className="px-3 py-2 rounded-lg bg-green-700"><Text className="text-white text-[11px] font-black">+ Nouveau</Text></Pressable>
        <Pressable onPress={onSync} disabled={syncing} className={`px-3 py-2 rounded-lg ${syncing ? "bg-gray-300" : "bg-ink"}`}><Text className="text-white text-[11px] font-bold">{syncing ? "Sync…" : "↻ Sync"}</Text></Pressable>
      </View>
      <FlatList
        data={filtered} keyExtractor={p => String(p.id)} keyboardShouldPersistTaps="handled" contentContainerClassName="gap-2 pb-5"
        ListEmptyComponent={<View className="p-5 rounded-xl bg-white"><Text className="text-center text-muted">Aucun produit ne correspond à ce filtre.</Text></View>}
        renderItem={({ item }) => (
          <View className="bg-white border border-line rounded-xl p-2.5 flex-row items-center gap-2.5">
            <ProductArtwork product={item} />
            <View className="flex-1 min-w-0">
              <Text numberOfLines={1} className="text-[13px] font-extrabold text-ink">{item.name}</Text>
              <Text numberOfLines={1} className="text-[10px] text-muted mt-0.5">{item.category || "Divers"} · #{item.id}</Text>
              <Text className="text-[12px] font-black text-ink mt-1">{money(item.price)} <Text className="text-[10px] font-normal text-muted">/ unité</Text></Text>
              <Text className={`text-[10px] font-bold mt-0.5 ${item.stock <= 0 ? "text-danger" : item.stock <= 5 ? "text-amber-700" : "text-success"}`}>{item.stock <= 0 ? "RUPTURE" : item.stock <= 5 ? "STOCK FAIBLE" : "EN STOCK"} · {item.stock} unité(s)</Text>
            </View>
            <View className="gap-1.5 items-stretch">
              <Pressable onPress={() => openMovement(item, "entry")} className="bg-green-50 border border-green-200 rounded-md px-2 py-1"><Text className="text-[10px] font-black text-green-800">+ Entrée</Text></Pressable>
              <Pressable onPress={() => openMovement(item, "exit")} className="bg-red-50 border border-red-200 rounded-md px-2 py-1"><Text className="text-[10px] font-black text-red-700">− Sortie</Text></Pressable>
              <Pressable onPress={() => openMovement(item, "edit")} className="border border-line rounded-md px-2 py-1"><Text className="text-[10px] font-bold text-ink">Modifier</Text></Pressable>
              <Pressable onPress={() => void showHistory(item)} className="px-2 py-1"><Text className="text-[10px] font-bold text-brand">Historique</Text></Pressable>
            </View>
          </View>
        )}
      />
      <Modal visible={createVisible} transparent animationType="slide" onRequestClose={() => setCreateVisible(false)}>
        <View className="flex-1 justify-end bg-black/45">
          <View className="bg-white rounded-t-2xl max-h-[94%] overflow-hidden">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-line">
              <Text className="text-lg font-black text-ink">Ajouter un produit</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={() => setCreateVisible(false)} className="px-2"><Text className="text-2xl text-muted">×</Text></Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 12 }}>
              <View className="flex-row gap-3">
                <View className="flex-1 gap-3">
                  <View><Text className="text-xs font-bold text-ink mb-1.5">Nom du produit *</Text><TextInput value={newName} onChangeText={setNewName} placeholder="Ex. : Riz 25 kg" className="border border-line rounded-lg px-3 py-3 text-ink" /></View>
                  <View><Text className="text-xs font-bold text-ink mb-1.5">Catégorie</Text>
                    <Pressable onPress={() => setShowCategoryChoices(v => !v)} className="border border-line rounded-lg px-3 py-3 flex-row items-center justify-between"><Text className={`text-sm ${newCategory ? "text-ink" : "text-muted"}`}>{newCategory || "Choisir une catégorie"}</Text><Text className="text-muted">⌄</Text></Pressable>
                    {showCategoryChoices && <View className="border border-line rounded-lg overflow-hidden">{Array.from(new Set(products.map(p => p.category).filter((v): v is string => Boolean(v)))).map(cat => <Pressable key={cat} onPress={() => { setNewCategory(cat); setShowCategoryChoices(false); }} className="px-3 py-2 border-b border-line"><Text className="text-sm text-ink">{cat}</Text></Pressable>)}<Pressable onPress={() => { setNewCategory(""); setShowCategoryChoices(false); }} className="px-3 py-2"><Text className="text-sm text-brand">+ Saisir une nouvelle catégorie</Text></Pressable></View>}
                    {!showCategoryChoices && <TextInput value={newCategory} onChangeText={setNewCategory} placeholder="Ou saisir une catégorie" className="border border-line rounded-lg px-3 py-2 mt-2 text-ink text-sm" />}
                  </View>
                  <View><Text className="text-xs font-bold text-ink mb-1.5">Description</Text><TextInput value={newDescription} onChangeText={setNewDescription} placeholder="Description courte (facultatif)" multiline numberOfLines={2} className="border border-line rounded-lg px-3 py-3 text-ink min-h-[64px]" /></View>
                </View>
                <View className="w-[124px]">
                  <Text className="text-xs font-bold text-ink mb-1.5">Image du produit</Text>
                  <Pressable onPress={() => void chooseProductImage()} className="border border-dashed border-line rounded-xl overflow-hidden bg-gray-50 items-center justify-center min-h-[150px]">
                    {newImageUri ? <Image source={{ uri: newImageUri }} resizeMode="cover" className="w-full h-[132px]" /> : <><Text className="text-3xl text-muted">▧</Text><Text className="text-xs font-bold text-ink mt-2">Ajouter une image</Text><Text className="text-[9px] text-muted mt-1">PNG, JPG, WEBP</Text></>}
                  </Pressable>
                  {!!newImageUri && <Pressable onPress={() => setNewImageUri(null)} className="mt-1"><Text className="text-xs text-danger text-center">Retirer l’image</Text></Pressable>}
                  <Text className="text-[10px] text-muted mt-1">Maximum 5 Mo</Text>
                </View>
              </View>
              <View className="flex-row gap-2 mt-1">
                <View className="flex-1"><Text className="text-xs font-bold text-ink mb-1.5">Prix d’achat (CDF)</Text><TextInput value={newPurchasePrice} onChangeText={setNewPurchasePrice} keyboardType="decimal-pad" placeholder="0.00" className="border border-line rounded-lg px-3 py-3 text-ink" /></View>
                <View className="flex-1"><Text className="text-xs font-bold text-ink mb-1.5">Prix de vente (CDF) *</Text><TextInput value={newPrice} onChangeText={setNewPrice} keyboardType="decimal-pad" placeholder="0.00" className="border border-line rounded-lg px-3 py-3 text-ink" /></View>
                <View className="w-[76px]"><Text className="text-xs font-bold text-ink mb-1.5">Stock</Text><TextInput value={newStock} onChangeText={setNewStock} keyboardType="number-pad" className="border border-line rounded-lg px-3 py-3 text-ink" /></View>
              </View>
              <View className="flex-row items-center justify-between bg-gray-50 rounded-xl px-3 py-2 mt-1"><Text className="text-sm text-ink">Actif (visible au point de vente)</Text><Switch value={newActive} onValueChange={setNewActive} trackColor={{ false: "#D1D5DB", true: "#86EFAC" }} thumbColor={newActive ? "#15803D" : "#F9FAFB"} /></View>
              <Text className="text-[10px] text-muted">Hors ligne, le produit reste local. L’image et les nouveaux champs ne seront partagés entre appareils que si l’API Laravel accepte ces champs et le téléversement d’image.</Text>
              <View className="flex-row justify-end gap-2 border-t border-line pt-3">
                <Pressable onPress={() => setCreateVisible(false)} className="border border-line rounded-lg px-4 py-3"><Text className="font-bold text-ink">Annuler</Text></Pressable>
                <Pressable disabled={creating} onPress={() => void saveNewProduct()} className={`rounded-lg px-4 py-3 ${creating ? "bg-gray-400" : "bg-ink"}`}><Text className="font-black text-white">{creating ? "Création…" : "Créer le produit"}</Text></Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View className="flex-1 justify-end bg-black/40">
          <Pressable className="flex-1" onPress={() => setSelected(null)} />
          <View className="bg-white rounded-t-3xl p-5 max-h-[85%]">
            <View className="flex-row items-center justify-between mb-4"><View className="flex-1"><Text className="text-lg font-black text-ink">{mode === "edit" ? "Modifier le produit" : mode === "history" ? "Mouvements de stock" : mode === "entry" ? "Entrée de stock" : mode === "exit" ? "Sortie de stock" : "Ajustement"}</Text><Text className="text-xs text-muted mt-1" numberOfLines={1}>{selected?.name}</Text></View><Pressable onPress={() => setSelected(null)}><Text className="text-2xl text-muted">×</Text></Pressable></View>
            {mode === "edit" ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-3">
              <Text className="text-xs font-bold text-muted">Nom du produit</Text><TextInput value={name} onChangeText={setName} className="border border-line rounded-lg px-3 py-3 text-ink" />
              <Text className="text-xs font-bold text-muted">Prix de vente</Text><TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad" className="border border-line rounded-lg px-3 py-3 text-ink" />
              <Text className="text-xs font-bold text-muted">Prix d'achat</Text><TextInput value={purchasePrice} onChangeText={setPurchasePrice} keyboardType="decimal-pad" className="border border-line rounded-lg px-3 py-3 text-ink" />
              <Text className="text-[11px] text-amber-800">Modification enregistrée sur cet appareil. La route API de modification produit n'existe pas dans la configuration actuelle.</Text>
              <Pressable onPress={() => void saveEdit()} className="bg-ink rounded-xl py-3.5 items-center"><Text className="text-white font-black">Enregistrer localement</Text></Pressable>
            </ScrollView> : mode === "history" ? <>
              <FlatList data={history} keyExtractor={m => String(m.id)} ListEmptyComponent={<Text className="text-sm text-muted py-4">Aucun mouvement enregistré.</Text>} renderItem={({item}) => <View className="border-b border-line py-3 flex-row items-center justify-between gap-3"><View className="flex-1"><Text className="font-bold text-ink text-sm">{item.movement_type === "entry" ? "Entrée" : item.movement_type === "exit" ? "Sortie" : "Ajustement"} · {item.quantity}</Text><Text className="text-[10px] text-muted mt-1">{item.reason || "Sans motif"} · {item.created_at}</Text><Text className="text-[10px] text-amber-800 mt-1">{item.sync_status === "pending" ? "En attente API serveur" : "Synchronisé"}</Text></View><Text className={`font-black ${item.delta < 0 ? "text-danger" : "text-success"}`}>{item.delta > 0 ? "+" : ""}{item.delta}</Text></View>} />
              <Pressable onPress={() => setSelected(null)} className="bg-ink rounded-xl py-3 mt-3 items-center"><Text className="text-white font-bold">Fermer</Text></Pressable>
            </> : <>
              <Text className="text-sm text-muted">Stock actuel : <Text className="font-black text-ink">{selected?.stock}</Text></Text>
              <Text className="text-xs font-bold text-muted mt-4 mb-1">{mode === "adjustment" ? "Nouveau stock total" : "Quantité"}</Text><TextInput value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" className="border border-line rounded-lg px-3 py-3 text-lg font-bold text-ink" />
              <Text className="text-xs font-bold text-muted mt-3 mb-1">Motif (facultatif)</Text><TextInput value={reason} onChangeText={setReason} placeholder="Réception fournisseur, casse, inventaire…" className="border border-line rounded-lg px-3 py-3 text-ink" />
              <Text className="text-[11px] text-amber-800 mt-3">Le mouvement est sauvegardé dans SQLite. Il sera conservé lors du prochain téléchargement du catalogue, mais son envoi au serveur exige un endpoint Laravel dédié.</Text>
              <Pressable onPress={() => void saveMovement()} className="bg-ink rounded-xl py-3.5 mt-4 items-center"><Text className="text-white font-black">Enregistrer le mouvement</Text></Pressable>
            </>}
          </View>
        </View>
      </Modal>
    </View>
  );
}
