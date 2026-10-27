import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import type { ProductRow } from "../db/database";
import { API_BASE_URL } from "../api/client";

function imageUri(image?: string | null): string | null {
  if (!image?.trim()) return null;
  const value = image.trim();
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_BASE_URL.replace(/\/api\/?$/, "")}/storage/${value.replace(/^\/+/, "").replace(/^storage\//i, "")}`;
}
function visual(p: ProductRow) {
  const v = `${p.name} ${p.category || ""}`.toLocaleLowerCase();
  if (v.includes("pain") || v.includes("baguette")) return "🥖";
  if (["bière", "export", "beaufort", "cider", "tembo", "simba"].some(x => v.includes(x))) return "🍺";
  if (["chauss", "basket"].some(x => v.includes(x))) return "👟";
  if (v.includes("chips")) return "🍟";
  if (["jus", "ceres"].some(x => v.includes(x))) return "🧃";
  if (["biscuit", "chocolat"].some(x => v.includes(x))) return "🍫";
  return "🛍️";
}
export default function ProductArtwork({ product }: { product: ProductRow }) {
  const uri = imageUri(product.image_url); const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return <View className="h-12 w-12 rounded-[10px] border border-line bg-slate-50 overflow-hidden items-center justify-center">
    {uri && !failed ? <Image source={{uri}} resizeMode="contain" onError={() => setFailed(true)} className="h-full w-full p-1" accessibilityLabel={`Image de ${product.name}`} /> : <Text className="text-[25px]">{visual(product)}</Text>}
  </View>;
}
