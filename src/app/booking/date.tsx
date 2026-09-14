import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useAuth } from "@clerk/expo";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { authedFetchJson } from "@/lib/api/client";
import { Colors } from "@/lib/theme/colors";
import { formatDisplayDate, formatMonthYear } from "@/lib/time/format";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ChooseDateScreen() {
  const { getToken } = useAuth();
  const params = useLocalSearchParams<{
    treatmentId: string;
    treatmentName: string;
    durationMinutes: string;
  }>();

  const [dates, setDates] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Calendar view state (Year & 0-indexed Month)
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(now.getUTCMonth());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await authedFetchJson<{ dates: string[] }>(
          getToken,
          `/api/availability/dates?treatmentId=${encodeURIComponent(params.treatmentId)}`,
        );
        if (cancelled) return;
        setDates(data.dates);

        // If available dates exist, jump calendar to the first available date's month
        if (data.dates.length > 0) {
          const [y, m] = data.dates[0].split("-").map(Number);
          setViewYear(y);
          setViewMonth(m - 1);
        }
      } catch (err) {
        console.error("Failed to load available dates:", err);
        if (!cancelled) setError("Couldn't load available dates. Please try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, params.treatmentId]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((prev) => prev - 1);
      setViewMonth(11);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((prev) => prev + 1);
      setViewMonth(0);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  const handleContinue = () => {
    if (!selectedDate) return;
    router.push({
      pathname: "/booking/slot",
      params: { ...params, date: selectedDate },
    });
  };

  // Build month grid
  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
  const startDayOfWeek = new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay();

  const calendarDays: ({ dayNum: number; dateStr: string } | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    calendarDays.push({ dayNum: d, dateStr: `${viewYear}-${mm}-${dd}` });
  }

  const availableSet = new Set(dates ?? []);

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={["bottom"]} className="flex-1 px-5">
        {/* Progress Bar & Step */}
        <View className="pt-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-[13px] font-semibold tracking-wide text-gray-400">
              STEP 2 OF 4
            </Text>
            <Text className="text-[13px] font-bold text-primary">Date</Text>
          </View>
          <View className="mt-2 h-1.5 w-full flex-row gap-1.5">
            <View className="h-full flex-1 rounded-full bg-primary" />
            <View className="h-full flex-1 rounded-full bg-primary" />
            <View className="h-full flex-1 rounded-full bg-gray-100" />
            <View className="h-full flex-1 rounded-full bg-gray-100" />
          </View>
        </View>

        {/* Title */}
        <View className="mt-6">
          <Text className="text-[26px] font-extrabold tracking-tight text-navy">
            Pick a date
          </Text>
          <Text className="mt-1 text-[15px] text-gray-500">
            {params.treatmentName} ({params.durationMinutes} min)
          </Text>
        </View>

        <ScrollView className="mt-6 flex-1" contentContainerClassName="pb-6">
          {dates === null && !error && (
            <View className="py-12 items-center">
              <ActivityIndicator color={Colors.NAVY} size="large" />
            </View>
          )}

          {error && (
            <View className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <Text className="text-center text-[14px] font-medium text-red-600">{error}</Text>
            </View>
          )}

          {dates && dates.length === 0 && (
            <View className="items-center rounded-2xl border border-gray-100 bg-sky/40 p-8">
              <Text className="text-center text-[15px] font-medium text-gray-600">
                No available dates found within the current booking window.
              </Text>
            </View>
          )}

          {dates && (
            <View className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-100">
              {/* Month Switcher Header */}
              <View className="flex-row items-center justify-between pb-4">
                <Pressable
                  onPress={handlePrevMonth}
                  className="h-10 w-10 items-center justify-center rounded-full bg-gray-50"
                >
                  <Text className="text-base font-bold text-navy">‹</Text>
                </Pressable>

                <Text className="text-[17px] font-bold text-navy">
                  {formatMonthYear(viewYear, viewMonth)}
                </Text>

                <Pressable
                  onPress={handleNextMonth}
                  className="h-10 w-10 items-center justify-center rounded-full bg-gray-50"
                >
                  <Text className="text-base font-bold text-navy">›</Text>
                </Pressable>
              </View>

              {/* Day of Week Labels */}
              <View className="flex-row justify-between border-b border-gray-100 pb-2.5">
                {WEEKDAYS.map((wd) => (
                  <View key={wd} className="flex-1 items-center">
                    <Text className="text-[12px] font-semibold text-gray-400">{wd}</Text>
                  </View>
                ))}
              </View>

              {/* Calendar Days Grid */}
              <View className="flex-row flex-wrap pt-2">
                {calendarDays.map((cell, index) => {
                  if (!cell) {
                    return <View key={`empty-${index}`} className="w-[14.28%] p-1 h-12" />;
                  }

                  const isAvailable = availableSet.has(cell.dateStr);
                  const isSelected = selectedDate === cell.dateStr;

                  return (
                    <View key={cell.dateStr} className="w-[14.28%] p-1">
                      <Pressable
                        onPress={() => isAvailable && setSelectedDate(cell.dateStr)}
                        disabled={!isAvailable}
                        className={`h-11 w-full items-center justify-center rounded-full ${
                          isSelected
                            ? "bg-primary shadow-sm shadow-primary/40"
                            : isAvailable
                              ? "bg-transparent active:bg-primary/10"
                              : "bg-transparent"
                        }`}
                      >
                        <Text
                          className={`text-[15px] ${
                            isSelected
                              ? "font-bold text-white"
                              : isAvailable
                                ? "font-semibold text-navy"
                                : "font-normal text-gray-300"
                          }`}
                        >
                          {cell.dayNum}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>

              {/* Bottom Legend / Guide */}
              <View className="mt-4 border-t border-gray-100 pt-3 flex-row items-center justify-center gap-4">
                <View className="flex-row items-center gap-1.5">
                  <View className="h-2.5 w-2.5 rounded-full bg-primary" />
                  <Text className="text-[12px] font-medium text-gray-500">Selected</Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <View className="h-2.5 w-2.5 rounded-full bg-navy" />
                  <Text className="text-[12px] font-medium text-gray-500">Available</Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <View className="h-2.5 w-2.5 rounded-full bg-gray-200" />
                  <Text className="text-[12px] font-medium text-gray-400">Unavailable</Text>
                </View>
              </View>
            </View>
          )}

          {selectedDate && (
            <View className="mt-4 rounded-2xl border border-primary/20 bg-sky/40 p-4">
              <Text className="text-[13px] font-semibold text-gray-500">SELECTED DATE</Text>
              <Text className="mt-1 text-[16px] font-bold text-navy">
                {formatDisplayDate(selectedDate)}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Sticky Continue Button */}
        <View className="border-t border-slate-100 pt-3 pb-4">
          <Pressable
            onPress={handleContinue}
            disabled={!selectedDate}
            className={`h-14 items-center justify-center rounded-full shadow-md ${
              selectedDate ? "bg-primary shadow-primary/30" : "bg-gray-200 shadow-none"
            }`}
          >
            <Text className={`text-[17px] font-bold ${selectedDate ? "text-white" : "text-gray-400"}`}>
              Continue
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
