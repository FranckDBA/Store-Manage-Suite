import React from "react";
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ProductArtwork, SectionTitle, Button } from "./shared";

type Props = { [key: string]: any };

export default function SalesTab(props: Props) {
  const { sales, money } = props;
  return (
<View className="flex-1 p-3.5">

            <SectionTitle

              title="Historique des ventes"

              subtitle="Transactions enregistrées sur le terminal"

              right={`${sales.length} vente(s)`}

            />

            <FlatList

              data={sales}

              keyExtractor={(s) => s.local_id}

              contentContainerClassName="gap-2.5 pb-5"

              renderItem={({ item }) => (

                <View className="bg-white border border-line rounded-xl p-3.5">

                  <View className="flex-row justify-between gap-2">

                    <Text className="font-black text-ink flex-1">

                      Vente #{item.local_id.slice(-7).toUpperCase()}

                    </Text>

                    <Text className="font-black text-success">

                      {money(item.total)}

                    </Text>

                  </View>

                  <Text className="text-[11px] text-muted mt-1.5">

                    {new Date(item.created_at).toLocaleString("fr-FR")}

                  </Text>

                  <View

                    className={`self-start mt-2 rounded-[7px] px-2 py-1 ${

                      item.status === "synced" ? "bg-successpale" : "bg-warnpale"

                    }`}

                  >

                    <Text

                      className={`text-[10px] font-black ${

                        item.status === "synced" ? "text-success" : "text-warn"

                      }`}

                    >

                      {item.status === "synced"

                        ? "Synchronisée"

                        : "En attente de synchronisation"}

                    </Text>

                  </View>

                </View>

              )}

              ListEmptyComponent={

                <Text className="text-muted">Aucune vente locale pour le moment.</Text>

              }

            />

          </View>
  );
}
