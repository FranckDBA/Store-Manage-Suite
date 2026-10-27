import React from "react";
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { ProductArtwork } from "./shared";
import { setCartQuantity } from "../pos/cart";
import type { ProductRow } from "../db/database";

type CartLine = {
  product: ProductRow;
  quantity: number;
};

type Props = {
  search: string;
  setSearch: (value: string) => void;
  filtered: ProductRow[];
  categories: string[];
  category: string;
  setCategory: (value: string) => void;
  add: (product: ProductRow) => void;
  cart: CartLine[];
  count: number;
  total: number;
  money: (value: number) => string;
  setCart: React.Dispatch<React.SetStateAction<CartLine[]>>;
  setCheckout: (value: boolean) => void;
  setCash: (value: string) => void;
  syncingProducts?: boolean;
};

export default function CashierTab(props: Props) {
  const {
    search,
    setSearch,
    filtered,
    categories,
    category,
    setCategory,
    add,
    cart,
    count,
    total,
    money,
    setCart,
    setCheckout,
    setCash,
  } = props;

  function clearCart() {
    if (!cart.length) return;

    Alert.alert(
      "Vider le panier ?",
      "Tous les articles ajoutés seront retirés du panier.",
      [
        { text: "Garder le panier", style: "cancel" },
        {
          text: "Vider le panier",
          style: "destructive",
          onPress: () => setCart([]),
        },
      ],
    );
  }

  return (
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
            returnKeyType="search"
          />

          {!!search && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Effacer la recherche"
              onPress={() => setSearch("")}
              hitSlop={8}
            >
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
              accessibilityRole="button"
              accessibilityLabel={`Ajouter ${item.name} au panier`}
              onPress={() => add(item)}
              className="flex-1 bg-white rounded-[12px] border border-line p-2.5 min-h-[100px] justify-between"
            >
              <ProductArtwork product={item} large />

              <Text
                numberOfLines={2}
                className="text-[12px] font-extrabold text-ink mt-1.5 min-h-[30px]"
              >
                {item.name}
              </Text>

              <Text className="text-[13px] font-black text-ink mt-1">
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
            <Text className="text-base font-black text-ink">
              Panier
            </Text>

            <Text className="text-[11px] text-muted mt-0.5">
              {count} article{count > 1 ? "s" : ""}
            </Text>
          </View>

          <View className="items-end">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Total à payer
            </Text>

            <Text className="text-[18px] font-black text-ink">
              {money(total)}
            </Text>
          </View>
        </View>

        {cart.length > 0 ? (
          <ScrollView
            showsVerticalScrollIndicator={cart.length > 2}
            className="mt-2 max-h-[165px]"
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            <View className="gap-2">
              {cart.map((line) => (
                <View
                  key={line.product.id}
                  className="flex-row items-center rounded-[11px] border border-line bg-bg p-2"
                >
                  <ProductArtwork product={line.product} />

                  <View className="flex-1 min-w-0 ml-2.5 mr-2">
                    <Text
                      numberOfLines={2}
                      className="text-[12px] font-extrabold text-ink"
                    >
                      {line.product.name}
                    </Text>

                    <Text className="text-[11px] text-muted mt-0.5">
                      {money(line.product.price)} × {line.quantity}
                    </Text>

                    <Text className="text-[12px] font-black text-ink mt-0.5">
                      {money(line.product.price * line.quantity)}
                    </Text>
                  </View>

                  <View className="items-center justify-center">
                    {/* Supprimer un produit */}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Retirer ${line.product.name} du panier`}
                      onPress={() =>
                        setCart((current) =>
                          setCartQuantity(current, line.product.id, 0),
                        )
                      }
                      hitSlop={8}
                      className="self-end px-2 py-1 mb-1"
                    >
                      <Text className="text-danger text-[15px] font-black">
                        ×
                      </Text>
                    </Pressable>

                    {/* Modifier la quantité */}
                    <View className="flex-row items-center rounded-[9px] border border-line bg-white">
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Diminuer la quantité de ${line.product.name}`}
                        onPress={() =>
                          setCart((current) =>
                            setCartQuantity(
                              current,
                              line.product.id,
                              line.quantity - 1,
                            ),
                          )
                        }
                        className="w-8 h-8 items-center justify-center"
                      >
                        <Text className="text-danger text-base font-black">
                          −
                        </Text>
                      </Pressable>

                      <Text className="min-w-[22px] text-center text-[12px] font-black text-ink">
                        {line.quantity}
                      </Text>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Augmenter la quantité de ${line.product.name}`}
                        onPress={() =>
                          setCart((current) =>
                            setCartQuantity(
                              current,
                              line.product.id,
                              line.quantity + 1,
                            ),
                          )
                        }
                        className="w-8 h-8 items-center justify-center"
                      >
                        <Text className="text-success text-base font-black">
                          +
                        </Text>
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

            <Text className="text-[12px] font-bold text-ink mt-1">
              Ton panier est vide
            </Text>

            <Text className="text-[11px] text-muted text-center mt-0.5">
              Appuie sur un produit pour l’ajouter ici.
            </Text>
          </View>
        )}

        {/* Actions du panier */}
        <View className="flex-row gap-2 mt-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Annuler et vider le panier"
            disabled={!cart.length}
            onPress={clearCart}
            className={`min-h-[50px] px-4 rounded-[12px] border items-center justify-center ${
              cart.length
                ? "bg-white border-line"
                : "bg-gray-100 border-line"
            }`}
          >
            <Text
              className={`font-extrabold text-sm ${
                cart.length ? "text-danger" : "text-muted"
              }`}
            >
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
              {cart.length
                ? `Encaisser · ${money(total)}`
                : "Ajoute des produits"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}