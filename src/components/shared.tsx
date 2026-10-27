
import { useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { API_BASE_URL } from "../api/client";
import type { ProductRow } from "../db/database";

function productImageUri(image?: string | null): string | null {
  if (!image || !image.trim()) return null;

  const value = image.trim();

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const serverBase = API_BASE_URL.replace(/\/api\/?$/, "");
  const path = value.replace(/^\/+/, "").replace(/^storage\//i, "");

  return `${serverBase}/storage/${path}`;
}

function productVisual(product: ProductRow): string {
  const value = (
    product.name +
    " " +
    (product.category || "")
  ).toLocaleLowerCase();

  if (
    value.includes("baguette") ||
    value.includes("pain") ||
    value.includes("pât")
  ) {
    return "🥖";
  }

  if (
    value.includes("bière") ||
    value.includes("export") ||
    value.includes("beaufort") ||
    value.includes("cider") ||
    value.includes("tembo") ||
    value.includes("simba")
  ) {
    return "🍺";
  }

  if (
    value.includes("chauss") ||
    value.includes("basquette") ||
    value.includes("basket")
  ) {
    return "👟";
  }

  if (value.includes("chips") || value.includes("chipse")) {
    return "🍟";
  }

  if (value.includes("jus") || value.includes("ceres")) {
    return "🧃";
  }

  if (
    value.includes("biscuit") ||
    value.includes("chocolat") ||
    value.includes("flik")
  ) {
    return "🍫";
  }

  return "🛍️";
}

export function ProductArtwork({
  product,
  large = false,
}: {
  product: ProductRow;
  large?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const uri = productImageUri(product.image_url);

  useEffect(() => {
    setImageFailed(false);
  }, [uri]);

  return (
    <View
      className={`items-center justify-center overflow-hidden bg-slate-50 ${
        large
          ? "h-[96px] -mx-2.5 -mt-2.5 mb-1 rounded-t-[11px] px-2 py-1"
          : "h-11 w-11 rounded-[9px]"
      }`}
    >
      {uri && !imageFailed ? (
        <Image
          source={{ uri }}
          resizeMode="contain"
          onError={() => setImageFailed(true)}
          className="h-full w-full"
          accessibilityLabel={`Image de ${product.name}`}
        />
      ) : (
        <Text className={large ? "text-[36px]" : "text-[23px]"}>
          {productVisual(product)}
        </Text>
      )}
    </View>
  );
}

export const money = (amount: number) =>
  new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + " FC";

// ─────────────────────────────────────────
// BOUTON PARTAGÉ
// ─────────────────────────────────────────

export function Button({
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
      accessibilityRole="button"
      className={`min-h-[47px] rounded-[10px] items-center justify-center px-3.5 ${
        outline ? "bg-white border border-line" : "bg-ink"
      } ${disabled ? "opacity-45" : "opacity-100"}`}
    >
      <Text
        className={`font-extrabold text-sm ${
          outline ? "text-ink" : "text-white"
        }`}
      >
        {title}
      </Text>
    </Pressable>
  );
}

// ─────────────────────────────────────────
// TITRE DE SECTION PARTAGÉ
// ─────────────────────────────────────────

export function SectionTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: string;
}) {
  return (
    <View className="mb-3 flex-row items-center justify-between gap-2">
      <View className="flex-1">
        <Text className="text-lg font-black text-ink">
          {title}
        </Text>

        {!!subtitle && (
          <Text className="mt-1 text-xs text-muted">
            {subtitle}
          </Text>
        )}
      </View>

      {!!right && (
        <Text className="text-right text-xs font-bold text-muted">
          {right}
        </Text>
      )}
    </View>
  );
}
