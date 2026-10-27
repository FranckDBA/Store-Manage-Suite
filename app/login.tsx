
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { login } from "../src/api/client";
import { saveAuthSession } from "../src/api/authStorage";
import { useAppAuth } from "./_layout";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { setAuthenticated } = useAppAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    if (loading) return;

    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
      setError("Saisis ton adresse e-mail et ton mot de passe.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log("[LOGIN] Tentative de connexion");

      const result = await login(normalizedEmail, password);

      if (!result?.token || !result?.user) {
        throw new Error("Le serveur n'a pas retourné une session valide.");
      }

      await saveAuthSession(result.token, result.user);

      // Actualiser le garde après l'enregistrement du jeton.
      setAuthenticated(true);

      console.log("[LOGIN] Session enregistrée");

      router.replace("/");
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Une erreur inattendue est survenue.";

      console.error("[LOGIN ERROR]", message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-slate-50"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="rounded-3xl border border-slate-200 bg-white p-6">
          <View className="mb-6 h-14 w-14 items-center justify-center rounded-2xl bg-green-100">
            <Text className="text-3xl">🛒</Text>
          </View>

          <Text className="mb-2 text-3xl font-extrabold text-slate-900">
            Store Manager Suite
          </Text>

          <Text className="mb-7 text-base leading-6 text-slate-500">
            Connecte-toi pour accéder à ton espace de gestion.
          </Text>

          <Text className="mb-2 font-semibold text-slate-700">
            Adresse e-mail
          </Text>

          <TextInput
            className="mb-5 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900"
            value={email}
            onChangeText={setEmail}
            placeholder="nom@exemple.com"
            placeholderTextColor="#94A3B8"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            accessibilityLabel="Adresse e-mail"
            returnKeyType="next"
          />

          <Text className="mb-2 font-semibold text-slate-700">
            Mot de passe
          </Text>

          <TextInput
            className="mb-5 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900"
            value={password}
            onChangeText={setPassword}
            placeholder="Ton mot de passe"
            placeholderTextColor="#94A3B8"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            onSubmitEditing={handleLogin}
            returnKeyType="go"
            accessibilityLabel="Mot de passe"
          />

          {error ? (
            <Text
              accessibilityRole="alert"
              className="mb-4 rounded-xl bg-red-50 p-3 leading-5 text-red-700"
            >
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            accessibilityRole="button"
            accessibilityState={{ disabled: loading, busy: loading }}
            className={`min-h-14 items-center justify-center rounded-xl px-4 py-4 ${
              loading ? "bg-green-400" : "bg-green-700"
            }`}
          >
            {loading ? (
              <View className="flex-row items-center">
                <ActivityIndicator color="#FFFFFF" />
                <Text className="ml-3 font-bold text-white">
                  Connexion en cours...
                </Text>
              </View>
            ) : (
              <Text className="text-base font-bold text-white">
                Se connecter
              </Text>
            )}
          </Pressable>

          <Text className="mt-5 text-center text-xs text-slate-500">
            Connexion sécurisée à ton serveur Laravel
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
