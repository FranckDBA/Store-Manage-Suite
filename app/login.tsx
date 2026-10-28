import React, { useState } from "react";
import {
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";

import { login } from "../src/api/client";
import { saveAuthSession } from "../src/api/authStorage";
import { useAppAuth } from "./_layout";

export default function LoginScreen() {
  const { setAuthenticated } = useAppAuth();
  const { width, height } = useWindowDimensions();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const compact = height < 780 || width < 380;

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      Alert.alert(
        "Champs obligatoires",
        "Saisis ton adresse e-mail et ton mot de passe."
      );
      return;
    }

    try {
      setLoading(true);

      const result = await login(normalizedEmail, password);

      if (!result?.token || !result?.user) {
        throw new Error("La réponse du serveur est invalide.");
      }

      await saveAuthSession(result.token, result.user);

      setAuthenticated(true);
      router.replace("/");
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Impossible de se connecter. Vérifie tes identifiants et réessaie.";

      Alert.alert("Connexion impossible", message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      "Mot de passe oublié",
      "La récupération du mot de passe doit être configurée sur ton serveur."
    );
  };

  return (
    <ImageBackground
      source={require("../assets/images/shop-background.png")}
      style={styles.background}
      resizeMode="cover"
      imageStyle={styles.backgroundImage}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#EAF7FF"
      />

      <View style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              compact && styles.scrollContentCompact,
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Logo */}
            <View style={styles.logoContainer}>
              <Image
                source={require("../assets/images/splash-logo.png")}
                style={[
                  styles.logo,
                  compact && styles.logoCompact,
                ]}
                resizeMode="contain"
                accessibilityLabel="Store Manager Suite"
              />
            </View>

            {/* Titre et description */}
            {/* <View style={styles.header}>
              <Text
                style={[
                  styles.heading,
                  compact && styles.headingCompact,
                ]}
              >
                Bienvenue{"\n"}dans ton espace.
              </Text>

              <Text style={styles.subtitle}>
                Connecte-toi pour gérer tes produits,
                {"\n"}tes ventes et ton activité.
              </Text>
            </View> */}

            {/* Carte de connexion */}
            <View
              style={[
                styles.card,
                compact && styles.cardCompact,
              ]}
            >
              <Text style={styles.cardTitle}>Connexion</Text>

              <Text style={styles.cardDescription}>
                
              </Text>

              {/* E-mail */}
              <Text style={styles.label}>Adresse e-mail</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>✉</Text>

                <View style={styles.inputDivider} />

                <TextInput
                  style={styles.input}
                  placeholder="nom@exemple.com"
                  placeholderTextColor="#7181AE"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  editable={!loading}
                  returnKeyType="next"
                  accessibilityLabel="Adresse e-mail"
                />
              </View>

              {/* Mot de passe */}
              <Text style={styles.label}>Mot de passe</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>🔒</Text>

                <View style={styles.inputDivider} />

                <TextInput
                  style={styles.input}
                  placeholder="Ton mot de passe"
                  placeholderTextColor="#7181AE"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="current-password"
                  textContentType="password"
                  editable={!loading}
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                  accessibilityLabel="Mot de passe"
                />

                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                >
                  <Text style={styles.eyeIcon}>
                    {showPassword ? "◉" : "◎"}
                  </Text>
                </Pressable>
              </View>

              {/* Se souvenir et mot de passe oublié */}
              <View style={styles.optionsRow}>
                <Pressable
                  style={styles.rememberContainer}
                  onPress={() => setRememberMe(!rememberMe)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: rememberMe }}
                >
                  <View
                    style={[
                      styles.checkbox,
                      rememberMe && styles.checkboxChecked,
                    ]}
                  >
                    {rememberMe && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>

                  <Text style={styles.rememberText}>
                    Se souvenir de moi
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleForgotPassword}
                  hitSlop={8}
                >
                  <Text style={styles.forgotText}>
                    Mot de passe oublié ?
                  </Text>
                </Pressable>
              </View>

              {/* Bouton de connexion */}
              <Pressable
                onPress={handleLogin}
                disabled={loading}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.loginButton,
                  pressed && !loading && styles.loginButtonPressed,
                  loading && styles.loginButtonDisabled,
                ]}
              >
                <LinearGradient
                  colors={["#08C987", "#00856A", "#006B57"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.loginGradient}
                >
                  {loading ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                      size="small"
                    />
                  ) : (
                    <>
                      <Text style={styles.loginButtonText}>
                        Se connecter
                      </Text>
                      <Text style={styles.arrow}>→</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>

              {/* Connexion sécurisée */}
              <View style={styles.secureRow}>
                <View style={styles.secureShield}>
                  <Text style={styles.secureCheck}>✓</Text>
                </View>

                <Text style={styles.secureText}>
                  Connexion sécurisée 
                </Text>
              </View>
            </View>

            {/* Fonctionnalités */}
            <View style={styles.features}>
              <View style={styles.feature}>
                <View style={styles.featureIconBox}>
                  <Text style={styles.featureIcon}>📦</Text>
                </View>
                <Text style={styles.featureText}>
                  Gestion{"\n"}de stock
                </Text>
              </View>

              <View style={styles.feature}>
                <View style={styles.featureIconBox}>
                  <Text style={styles.featureIcon}>📊</Text>
                </View>
                <Text style={styles.featureText}>
                  Suivi{"\n"}des ventes
                </Text>
              </View>

              <View style={styles.feature}>
                <View style={styles.featureIconBox}>
                  <Text style={styles.featureIcon}>⚙️</Text>
                </View>
                <Text style={styles.featureText}>
                  Configuration{"\n"}simplifiée
                </Text>
              </View>
            </View>

            {/* Pagination décorative */}
            <View style={styles.pagination}>
              <View style={[styles.dot, styles.activeDot]} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: "#EAF7FF",
  },

  backgroundImage: {
    opacity: 1,
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(239, 249, 255, 0.48)",
  },

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 20,
  },

  scrollContentCompact: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },

  logoContainer: {
    alignItems: "flex-start",
    marginBottom: 9,
  
  },

  logo: {
    width: 205,
    height: 92,
  },

  logoCompact: {
    width: 170,
    height: 70,
  },

  header: {
    marginBottom: 22,
  },

  heading: {
    color: "#101D50",
    fontSize: 35,
    lineHeight: 39,
    fontWeight: "800",
    letterSpacing: -1,
  },

  headingCompact: {
    fontSize: 30,
    lineHeight: 34,
  },

  subtitle: {
    color: "#6477A9",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 10,
    fontWeight: "400",
  },

  card: {
    width: "100%",
    paddingHorizontal: 18,
    paddingTop: 19,
    paddingBottom: 15,
    borderRadius: 25,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderWidth: 1,
    borderColor: "#E1F0FC",
    shadowColor: "#41769D",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.13,
    shadowRadius: 16,
    elevation: 6,
  },

  cardCompact: {
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 12,
    borderRadius: 21,
  },

  cardTitle: {
    color: "#101D50",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
  },

  cardDescription: {
    color: "#7080AD",
    fontSize: 14,
    marginTop: 3,
    marginBottom: 19,
  },

  label: {
    color: "#101D50",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
  },

  inputContainer: {
    minHeight: 53,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.2,
    borderColor: "#C9DFFB",
    backgroundColor: "#F4F9FE",
    borderRadius: 15,
    paddingHorizontal: 11,
    marginBottom: 16,
  },

  inputIcon: {
    width: 31,
    textAlign: "center",
    color: "#4D5F91",
    fontSize: 23,
    fontWeight: "600",
  },

  inputDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#D7E5F6",
    marginHorizontal: 9,
  },

  input: {
    flex: 1,
    minWidth: 0,
    color: "#142451",
    fontSize: 15,
    paddingVertical: Platform.OS === "ios" ? 13 : 8,
  },

  eyeButton: {
    width: 34,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },

  eyeIcon: {
    color: "#4D5F91",
    fontSize: 24,
    fontWeight: "600",
  },

  optionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    rowGap: 10,
    marginTop: 1,
    marginBottom: 19,
  },

  rememberContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#A8BCD4",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },

  checkboxChecked: {
    backgroundColor: "#079B68",
    borderColor: "#079B68",
  },

  checkmark: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 20,
  },

  rememberText: {
    color: "#506392",
    fontSize: 12,
    fontWeight: "500",
  },

  forgotText: {
    color: "#008B61",
    fontSize: 12,
    fontWeight: "700",
  },

  loginButton: {
  width: "100%",
  minHeight: 55,
  borderRadius: 16,
  overflow: "hidden",
  backgroundColor: "#00856A",
},

loginGradient: {
  width: "100%",
  minHeight: 55,
  borderRadius: 16,
  overflow: "hidden",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 12,
},

  loginButtonPressed: {
    opacity: 0.86,
  },

  loginButtonDisabled: {
    opacity: 0.75,
  },

  loginGradient: {
    flex: 1,
    minHeight: 55,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },

  arrow: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "500",
    marginLeft: 13,
    marginTop: -2,
  },

  secureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 13,
    gap: 8,
  },

  secureShield: {
    width: 23,
    height: 25,
    borderRadius: 8,
    backgroundColor: "#08B975",
    alignItems: "center",
    justifyContent: "center",
  },

  secureCheck: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },

  secureText: {
    color: "#6477A9",
    fontSize: 11,
    flexShrink: 1,
  },

  features: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 19,
    paddingHorizontal: 1,
  },

  feature: {
    flex: 1,
    alignItems: "center",
  },

  featureIconBox: {
    width: 32,
    height: 31,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EDF5FC",
  },

  featureIcon: {
    fontSize: 14,
  },

  featureText: {
    color: "#101D50",
    textAlign: "center",
    fontSize: 10,
    lineHeight: 16,
    fontWeight: "600",
    marginTop: 7,
  },

  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginTop: 17,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#C4D7E9",
  },

  activeDot: {
    backgroundColor: "#079B68",
  },
});
