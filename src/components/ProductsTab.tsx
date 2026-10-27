import React from "react";
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ProductArtwork, SectionTitle, Button } from "./shared";

type Props = { [key: string]: any };

export default function ProductsTab(props: Props) {
  const { products, money } = props;
  return (
<View className="flex-1 p-3.5">

            <SectionTitle

              title="Produits disponibles"

              subtitle="Catalogue local du terminal"

              right={`${products.length} produit(s)`}

            />

            <FlatList

              data={products}

              keyExtractor={(p) => String(p.id)}

              contentContainerClassName="gap-2 pb-5"

              renderItem={({ item }) => (

                <View className="bg-white rounded-xl border border-line p-3 flex-row items-center gap-2.5">

                  <ProductArtwork product={item} />

                  <View className="flex-1">

                    <Text className="font-extrabold text-ink">{item.name}</Text>

                    <Text className="text-[11px] text-muted mt-0.5">

                      {item.category || "Divers"} · {money(item.price)}

                    </Text>

                  </View>

                  <Text

                    className={`font-black ${

                      item.stock > 0 ? "text-success" : "text-danger"

                    }`}

                  >

                    {item.stock}

                  </Text>

                </View>

              )}

            />

          </View>
  );
}
