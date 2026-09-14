import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useAuth } from "@clerk/expo";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { authedFetchJson } from "@/lib/api/client";
import { Colors } from "@/lib/theme/colors";
import { formatDisplayDate, formatDisplayTime } from "@/lib/time/format";
import { AppIcon } from "@/lib/ui/icon";

type BookableSlot = { startTime: string; endTime: string; remainingCapacity: number };

export default function ChooseSlotScreen() {
  const { getToken } = useAuth();
  const params = useLocalSearchParams<{
    treatmentId: string;
    treatmentName: string;
    durationMinutes: string;
    date: string;
  }>();

  const [slots, setSlots] = useState<BookableSlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedStartTime, setSelectedStartTime] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await authedFetchJson<{ slots: BookableSlot[] }>(
          getToken,
          `/api/availability/slots?treatmentId=${encodeURIComponent(params.treatmentId)}&date=${encodeURIComponent(params.date)}`,
        );
        if (!cancelled) setSlots(data.slots);
      } catch (err) {
        console.error("Failed to load available slots:", err);
        if (!cancelled) setError("Couldn't load available times. Please try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, params.treatmentId, params.date]);

  const handleContinue = () => {
    if (!selectedStartTime) return;
    router.push({
      pathname: "/booking/confirm",
      params: { ...params, startTime: selectedStartTime },
    });
  };

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={["bottom"]} className="flex-1 px-5">
        {/* Progress Bar & Step */}
        <View className="pt-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-[13px] font-semibold tracking-wide text-gray-400">
              STEP 3 OF 4
            </Text>
            <Text className="text-[13px] font-bold text-primary">Time</Text>
          </View>
          <View className="mt-2 h-1.5 w-full flex-row gap-1.5">
            <View className="h-full flex-1 rounded-full bg-primary" />
            <View className="h-full flex-1 rounded-full bg-primary" />
            <View className="h-full flex-1 rounded-full bg-primary" />
            <View className="h-full flex-1 rounded-full bg-gray-100" />
          </View>
        </View>

        {/* Title */}
        <View className="mt-6">
          <Text className="text-[26px] font-extrabold tracking-tight text-navy">
            Pick a time
          </Text>
          <View className="mt-2 flex-row items-center gap-2">
            <View className="rounded-full bg-sky px-3 py-1 border border-primary/20">
              <Text className="text-[13px] font-semibold text-primary-dark">
                {`${formatDisplayDate(params.date)} · ${params.durationMinutes} min`}
              </Text>
            </View>
          </View>
        </View>

        {/* Slots Grid */}
        <ScrollView className="mt-6 flex-1" contentContainerClassName="pb-6">
          {slots === null && !error && (
            <View className="py-12 items-center">
              <ActivityIndicator color={Colors.NAVY} size="large" />
            </View>
          )}

          {error && (
            <View className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <Text className="text-center text-[14px] font-medium text-red-600">{error}</Text>
            </View>
          )}

          {slots && slots.length === 0 && (
            <View className="items-center rounded-2xl border border-gray-100 bg-sky/40 p-8">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <AppIcon name="clock" size={22} color={Colors.PRIMARY} />
              </View>
              <Text className="mt-3 text-[16px] font-bold text-navy">No times available</Text>
              <Text className="mt-1 text-center text-[14px] text-gray-500">
                All slots on this date are fully booked or past the 48-hour advance window. Please select another date.
              </Text>
            </View>
          )}

          {slots && slots.length > 0 && (
            <View className="flex-row flex-wrap gap-3">
              {slots.map((slot) => {
                const isSelected = slot.startTime === selectedStartTime;
                const isLow = slot.remainingCapacity <= 1;

                return (
                  <Pressable
                    key={slot.startTime}
                    onPress={() => setSelectedStartTime(slot.startTime)}
                    className={`w-[48%] rounded-2xl p-4 ${
                      isSelected
                        ? "border-2 border-primary bg-sky/50 shadow-sm shadow-primary/20"
                        : "border border-slate-200/80 bg-white shadow-sm shadow-slate-100"
                    }`}
                  >
                    <Text className="text-[18px] font-extrabold text-navy">
                      {formatDisplayTime(slot.startTime)}
                    </Text>

                    <View className="mt-2 flex-row items-center gap-1.5">
                      <View
                        className={`h-2 w-2 rounded-full ${
                          isLow ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                      />
                      <Text
                        className={`text-[12px] font-medium ${
                          isLow ? "text-amber-700" : "text-emerald-700"
                        }`}
                      >
                        {slot.remainingCapacity === 1
                          ? "Only 1 spot left"
                          : `${slot.remainingCapacity} spots left`}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Sticky Continue Button */}
        <View className="border-t border-slate-100 pt-3 pb-4">
          <Pressable
            onPress={handleContinue}
            disabled={!selectedStartTime}
            className={`h-14 items-center justify-center rounded-full shadow-md ${
              selectedStartTime ? "bg-primary shadow-primary/30" : "bg-gray-200 shadow-none"
            }`}
          >
            <Text
              className={`text-[17px] font-bold ${
                selectedStartTime ? "text-white" : "text-gray-400"
              }`}
            >
              Continue
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
