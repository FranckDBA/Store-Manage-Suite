import { useEffect, useState } from "react";
import {
  Alert,
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
import * as ImagePicker from "expo-image-picker";
import type { SQLiteDatabase } from "expo-sqlite";
import {
  DEFAULT_STORE_SETTINGS,
  getStoreSettings,
  saveStoreSettings,
  type StoreSettings,
} from "./storeSettings";

type Props = { db: SQLiteDatabase };

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
};

function Field({ label, value, onChangeText, placeholder, keyboardType = "default", autoCapitalize = "sentences" }: FieldProps) {
  return (
    <View className="mb-3">
      <Text className="mb-1.5 text-xs font-extrabold text-ink">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        className="min-h-[47px] rounded-[11px] border border-line bg-white px-3.5 py-3 text-[13px] text-ink"
      />
    </View>
  );
}

export default function SettingsScreen({ db }: Props) {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    getStoreSettings(db)
      .then((value) => { if (mounted) setSettings(value); })
      .catch((error) => Alert.alert("Configuration", error instanceof Error ? error.message : "Impossible de charger les paramètres."))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [db]);

  function update<K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function chooseLogo() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Autorisation requise", "Autorise l'accès aux photos pour choisir le logo du magasin.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.65,
        base64: true,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert("Logo indisponible", "Impossible de lire cette image. Essaie avec une autre image.");
        return;
      }
      const mime = asset.mimeType === "image/png" ? "image/png" : "image/jpeg";
      update("logo_data_url", `data:${mime};base64,${asset.base64}`);
    } catch (error) {
      Alert.alert("Sélection du logo impossible", error instanceof Error ? error.message : "Une erreur est survenue.");
    }
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await saveStoreSettings(db, settings);
      Alert.alert("Configuration enregistrée", "Les informations du magasin sont conservées sur cet appareil.");
    } catch (error) {
      Alert.alert("Enregistrement impossible", error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
    >
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: 14, paddingBottom: 240, flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      nestedScrollEnabled
      showsVerticalScrollIndicator
    >
      <View className="mb-3 rounded-[14px] border border-line bg-white p-4">
        <Text className="text-lg font-black text-ink">Configuration du magasin</Text>
        <Text className="mt-1 text-xs leading-5 text-muted">Ces paramètres sont enregistrés localement sur cet appareil. Ils ne sont pas encore synchronisés avec Laravel.</Text>
      </View>

      <View className="mb-3 rounded-[14px] border border-line bg-white p-4">
        <Text className="mb-3 text-sm font-black text-ink">Identité visuelle</Text>
        <View className="mb-3 flex-row items-center gap-3">
          <View className="h-[86px] w-[86px] items-center justify-center overflow-hidden rounded-[14px] border border-line bg-slate-50">
            {settings.logo_data_url ? <Image source={{ uri: settings.logo_data_url }} resizeMode="contain" className="h-full w-full" /> : <Text className="text-3xl">🏪</Text>}
          </View>
          <View className="flex-1 gap-2">
            <Pressable onPress={() => void chooseLogo()} className="min-h-[43px] items-center justify-center rounded-[10px] bg-ink px-3">
              <Text className="text-xs font-extrabold text-white">Choisir un logo</Text>
            </Pressable>
            {!!settings.logo_data_url && <Pressable onPress={() => update("logo_data_url", "")} className="min-h-[38px] items-center justify-center rounded-[10px] border border-line px-3"><Text className="text-xs font-bold text-danger">Supprimer le logo</Text></Pressable>}
          </View>
        </View>
        <Field label="Nom du magasin *" value={settings.store_name} onChangeText={(v) => update("store_name", v)} placeholder="Ex. POS MARKET" />
      </View>

      <View className="mb-3 rounded-[14px] border border-line bg-white p-4">
        <Text className="mb-3 text-sm font-black text-ink">Coordonnées</Text>
        <Field label="Adresse" value={settings.address} onChangeText={(v) => update("address", v)} placeholder="Rue, numéro, quartier" />
        <Field label="Ville" value={settings.city} onChangeText={(v) => update("city", v)} />
        <Field label="Pays" value={settings.country} onChangeText={(v) => update("country", v)} />
        <Field label="Téléphone" value={settings.phone} onChangeText={(v) => update("phone", v)} keyboardType="phone-pad" />
        <Field label="E-mail" value={settings.email} onChangeText={(v) => update("email", v)} keyboardType="email-address" autoCapitalize="none" />
      </View>

      <View className="mb-3 rounded-[14px] border border-line bg-white p-4">
        <Text className="mb-3 text-sm font-black text-ink">Informations administratives</Text>
        <Field label="RCCM (si applicable)" value={settings.rccm} onChangeText={(v) => update("rccm", v)} autoCapitalize="characters" />
        <Field label="NIF (si applicable)" value={settings.nif} onChangeText={(v) => update("nif", v)} autoCapitalize="characters" />
      </View>

      <Pressable disabled={loading || saving} onPress={() => void save()} className={`min-h-[50px] items-center justify-center rounded-[12px] ${loading || saving ? "bg-gray-400" : "bg-ink"}`}>
        <Text className="text-sm font-black text-white">{loading ? "Chargement…" : saving ? "Enregistrement…" : "Enregistrer la configuration"}</Text>
      </Pressable>
      {/* <Pressable
        onPress={() => Keyboard.dismiss()}
        className="mt-2 min-h-[42px] items-center justify-center rounded-[10px] border border-line bg-white"
      >
        <Text className="text-xs font-bold text-muted">Masquer le clavier</Text>
      </Pressable> */}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
