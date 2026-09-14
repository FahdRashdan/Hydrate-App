import { Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors } from "@/lib/theme/colors";
import { formatDisplayDateTime } from "@/lib/time/format";
import { AppIcon } from "@/lib/ui/icon";

export default function BookingSuccessScreen() {
  const params = useLocalSearchParams<{
    treatmentName?: string;
    date?: string;
    startTime?: string;
    durationMinutes?: string;
  }>();

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={["bottom"]} className="flex-1">
        <ScrollView className="flex-1 px-6 pt-6" contentContainerClassName="items-center pb-8">
          {/* Animated/Glowing Checkmark Badge */}
          <View className="mt-8 h-24 w-24 items-center justify-center rounded-full bg-primary/15">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/40">
              <AppIcon name="checkmark" size={28} color="#FFFFFF" />
            </View>
          </View>

          {/* Title */}
          <Text className="mt-6 text-center text-[28px] font-extrabold tracking-tight text-navy">
            Booking Request Sent!
          </Text>

          {/* Pending Status Badge */}
          <View
            className="mt-3 rounded-full border px-3.5 py-1"
            style={{
              backgroundColor: Colors.AMBER_BG,
              borderColor: "#FDE68A",
            }}
          >
            <Text
              className="text-[12px] font-bold uppercase tracking-wider"
              style={{ color: Colors.AMBER_TEXT }}
            >
              Pending Confirmation
            </Text>
          </View>

          <Text className="mt-3 text-center text-[15px] leading-[22px] text-gray-500 px-4">
            Your booking request has been submitted. The clinic will confirm your appointment shortly.
          </Text>

          {/* Summary Card (if params exist) */}
          {params.treatmentName && params.date && params.startTime && (
            <View className="mt-8 w-full rounded-3xl border border-slate-200/80 bg-sky/40 p-5 shadow-sm shadow-slate-100">
              <View className="flex-row items-center gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-xl bg-primary">
                  <AppIcon name="drop.fill" size={20} color="#FFFFFF" />
                </View>
                <View className="flex-1">
                  <Text className="text-[17px] font-bold text-navy">
                    {params.treatmentName}
                  </Text>
                  {params.durationMinutes && (
                    <Text className="text-[12px] font-medium text-gray-500">
                      {params.durationMinutes} min treatment
                    </Text>
                  )}
                </View>
              </View>

              <View className="mt-4 border-t border-primary/10 pt-3 gap-2.5">
                <View className="flex-row items-center gap-2">
                  <AppIcon name="calendar" size={16} color={Colors.LABEL_GRAY} />
                  <Text className="text-[15px] font-semibold text-navy">
                    {formatDisplayDateTime(params.date, params.startTime)}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <AppIcon name="mappin.and.ellipse" size={16} color={Colors.LABEL_GRAY} />
                  <Text className="text-[14px] text-gray-600">
                    Hydrate — Main Location
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Clinic changes note */}
          <Text className="mt-8 text-center text-[13px] text-gray-400">
            Need to make changes? Contact the clinic directly.
          </Text>

          {/* Done CTA Button */}
          <Pressable
            onPress={() => router.replace("/(customer)")}
            className="mt-8 h-14 w-full items-center justify-center rounded-full bg-navy shadow-md shadow-navy/30"
          >
            <Text className="text-[17px] font-bold text-white">Done</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
