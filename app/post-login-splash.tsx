import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { useAppAuth } from "./_layout";

export default function PostLoginSplashScreen() {
  const { authenticated } = useAppAuth();

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 650,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        speed: 2,
        bounciness: 4,
        useNativeDriver: true,
      }),
      Animated.timing(progress, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    ]);

    animation.start();

    const timer = setTimeout(() => {
      router.replace(authenticated ? "/" : "/login");
    }, 2200);

    return () => {
      clearTimeout(timer);
      animation.stop();
    };
  }, [authenticated, opacity, scale, progress]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity,
            transform: [{ scale }],
          },
        ]}
      >
        <Image
          source={require("../assets/images/splash-logo.png")}
          resizeMode="contain"
          style={styles.logo}
          accessibilityLabel="Logo Store Manager Suite"
        />
      </Animated.View>

      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  logoContainer: {
    width: "82%",
    maxWidth: 340,
    height: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  progressTrack: {
    position: "absolute",
    bottom: 48,
    width: 120,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#E2E8F0",
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#16A34A",
    borderRadius: 4,
  },
});
