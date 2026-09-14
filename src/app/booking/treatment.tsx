import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useAuth } from "@clerk/expo";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { authedFetchJson } from "@/lib/api/client";
import { Colors } from "@/lib/theme/colors";
import { AppIcon } from "@/lib/ui/icon";

type Treatment = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
};

export default function ChooseTreatmentScreen() {
  const { getToken } = useAuth();
  const [treatments, setTreatments] = useState<Treatment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await authedFetchJson<Treatment[]>(getToken, "/api/treatments");
        if (!cancelled) setTreatments(rows);
      } catch (err) {
        console.error("Failed to load treatments:", err);
        if (!cancelled) setError("Couldn't load treatments. Please try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const selected = treatments?.find((t) => t.id === selectedId) ?? null;

  const handleContinue = () => {
    if (!selected) return;
    router.push({
      pathname: "/booking/date",
      params: {
        treatmentId: selected.id,
        treatmentName: selected.name,
        durationMinutes: String(selected.durationMinutes),
      },
    });
  };

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={["bottom"]} className="flex-1 px-5">
        {/* Progress Bar & Step */}
        <View className="pt-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-[13px] font-semibold tracking-wide text-gray-400">
              STEP 1 OF 4
            </Text>
            <Text className="text-[13px] font-bold text-primary">Treatment</Text>
          </View>
          <View className="mt-2 h-1.5 w-full flex-row gap-1.5">
            <View className="h-full flex-1 rounded-full bg-primary" />
            <View className="h-full flex-1 rounded-full bg-gray-100" />
            <View className="h-full flex-1 rounded-full bg-gray-100" />
            <View className="h-full flex-1 rounded-full bg-gray-100" />
          </View>
        </View>

        {/* Title */}
        <View className="mt-6">
          <Text className="text-[26px] font-extrabold tracking-tight text-navy">
            Choose your treatment
          </Text>
          <Text className="mt-1 text-[15px] text-gray-500">
            Select a treatment to get started.
          </Text>
        </View>

        {/* Treatment Cards List */}
        <ScrollView className="mt-6 flex-1" contentContainerClassName="gap-3 pb-6">
          {treatments === null && !error && (
            <View className="py-12 items-center">
              <ActivityIndicator color={Colors.NAVY} size="large" />
            </View>
          )}

          {error && (
            <View className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <Text className="text-center text-[14px] font-medium text-red-600">{error}</Text>
            </View>
          )}

          {treatments?.map((treatment) => {
            const isSelected = treatment.id === selectedId;
            return (
              <Pressable
                key={treatment.id}
                onPress={() => setSelectedId(treatment.id)}
                className={`rounded-2xl border-2 p-5 ${
                  isSelected
                    ? "border-primary bg-sky/50 shadow-sm shadow-primary/10"
                    : "border-slate-200/80 bg-white shadow-sm shadow-slate-100"
                }`}
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                    <View
                      className={`h-12 w-12 items-center justify-center rounded-2xl ${
                        isSelected ? "bg-primary" : "bg-sky"
                      }`}
                    >
                      <AppIcon
                        name="drop.fill"
                        size={20}
                        color={isSelected ? "#FFFFFF" : Colors.PRIMARY}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[17px] font-bold text-navy">
                        {treatment.name}
                      </Text>
                      <View className="mt-1 flex-row items-center gap-2">
                        <View className="rounded-full bg-primary/15 px-2.5 py-0.5">
                          <Text className="text-[11px] font-bold text-primary-dark">
                            {treatment.durationMinutes} min
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Radio indicator */}
                  <View
                    className={`h-6 w-6 items-center justify-center rounded-full border-2 mt-1 ${
                      isSelected ? "border-primary bg-primary" : "border-gray-300 bg-transparent"
                    }`}
                  >
                    {isSelected && (
                      <View className="h-2.5 w-2.5 rounded-full bg-white" />
                    )}
                  </View>
                </View>

                {treatment.description && (
                  <Text className="mt-3 text-[14px] leading-[20px] text-gray-600">
                    {treatment.description}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Sticky Continue Button */}
        <View className="border-t border-slate-100 pt-3 pb-4">
          <Pressable
            onPress={handleContinue}
            disabled={!selected}
            className={`h-14 items-center justify-center rounded-full shadow-md ${
              selected ? "bg-primary shadow-primary/30" : "bg-gray-200 shadow-none"
            }`}
          >
            <Text className={`text-[17px] font-bold ${selected ? "text-white" : "text-gray-400"}`}>
              Continue
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
