import React from "react";
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ProductArtwork, SectionTitle, Button } from "./shared";

type Props = { [key: string]: any };

export default function SyncTab(props: Props) {
  const { pending, syncingProducts, syncCatalog, sync, refresh } = props;
  return (
<View className="flex-1 p-3.5 gap-3">

            <View className="bg-white rounded-[14px] border border-line p-4">

              <Text className="text-[11px] font-black tracking-[1.3px] text-muted">

                SYNCHRONISATION

              </Text>

              <Text className="text-[28px] font-black text-ink mt-2">

                {pending} vente(s)

              </Text>

              <Text className="text-[13px] text-muted leading-5 mt-1">

                en attente d'envoi vers le serveur.

              </Text>

              <View className="h-px bg-line my-3.5" />

              <Text className="text-[13px] text-ink leading-5">

                Les ventes sont conservées localement. L'envoi réel sera activé après la

                création des endpoints API sécurisés et du mécanisme anti-doublon.

              </Text>

            </View>

            <Button
              title={
                syncingProducts
                  ? "Synchronisation des produits..."
                  : "Synchroniser les produits"
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
  );
}
