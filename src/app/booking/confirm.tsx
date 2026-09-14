import { useEffect, useState } from "react";
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
import { useAuth } from "@clerk/expo";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError, authedFetchJson } from "@/lib/api/client";
import { Colors } from "@/lib/theme/colors";
import { formatDisplayDateTime } from "@/lib/time/format";
import { AppIcon } from "@/lib/ui/icon";

type Profile = { firstName: string | null; lastName: string | null; phone: string | null };

export default function ConfirmBookingScreen() {
  const { getToken } = useAuth();
  const params = useLocalSearchParams<{
    treatmentId: string;
    treatmentName: string;
    durationMinutes: string;
    date: string;
    startTime: string;
  }>();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [prefillLoaded, setPrefillLoaded] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState<{ message: string; action: "retry-slot" | "restart" } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await authedFetchJson<Profile>(getToken, "/api/profile");
        if (cancelled) return;
        setName([profile.firstName, profile.lastName].filter(Boolean).join(" "));
        setPhone(profile.phone ?? "");
      } catch (err) {
        console.error("Failed to prefill profile:", err);
      } finally {
        if (!cancelled) setPrefillLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const canSubmit = name.trim().length > 0 && phone.trim().length > 0 && status !== "submitting";

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setError(null);
    setStatus("submitting");
    try {
      await authedFetchJson(getToken, "/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          treatmentId: params.treatmentId,
          date: params.date,
          startTime: params.startTime,
          customerName: name.trim(),
          customerPhone: phone.trim(),
        }),
      });
      router.replace({
        pathname: "/booking/success",
        params: {
          treatmentName: params.treatmentName,
          date: params.date,
          startTime: params.startTime,
          durationMinutes: params.durationMinutes,
        },
      });
    } catch (err) {
      const code = err instanceof ApiError ? err.message : "UNKNOWN_ERROR";
      if (code === "SLOT_FULL") {
        setError({ message: "That time just got booked by someone else.", action: "retry-slot" });
      } else {
        setError({ message: "This booking is no longer available.", action: "restart" });
      }
      setStatus("idle");
    }
  };

  const handleErrorAction = () => {
    if (error?.action === "retry-slot") {
      router.replace({
        pathname: "/booking/slot",
        params: {
          treatmentId: params.treatmentId,
          treatmentName: params.treatmentName,
          durationMinutes: params.durationMinutes,
          date: params.date,
        },
      });
    } else {
      router.replace("/booking/treatment");
    }
  };

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={["bottom"]} className="flex-1">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
          <ScrollView className="flex-1 px-5" keyboardShouldPersistTaps="handled">
            {/* Progress Bar & Step */}
            <View className="pt-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-[13px] font-semibold tracking-wide text-gray-400">
                  STEP 4 OF 4
                </Text>
                <Text className="text-[13px] font-bold text-primary">Confirm</Text>
              </View>
              <View className="mt-2 h-1.5 w-full flex-row gap-1.5">
                <View className="h-full flex-1 rounded-full bg-primary" />
                <View className="h-full flex-1 rounded-full bg-primary" />
                <View className="h-full flex-1 rounded-full bg-primary" />
                <View className="h-full flex-1 rounded-full bg-primary" />
              </View>
            </View>

            {/* Title */}
            <View className="mt-6">
              <Text className="text-[26px] font-extrabold tracking-tight text-navy">
                Confirm details
              </Text>
              <Text className="mt-1 text-[15px] text-gray-500">
                Please review your appointment summary
              </Text>
            </View>

            {/* Card 1: Your Information */}
            <View className="mt-6 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-100">
              <View className="flex-row items-center justify-between">
                <Text className="text-[15px] font-bold tracking-tight text-navy">
                  Your Information
                </Text>
                <Pressable onPress={() => setIsEditingInfo(!isEditingInfo)}>
                  <Text className="text-[13px] font-bold text-primary-dark">
                    {isEditingInfo ? "Done" : "Edit"}
                  </Text>
                </Pressable>
              </View>

              {!prefillLoaded ? (
                <ActivityIndicator color={Colors.NAVY} className="my-4" />
              ) : isEditingInfo ? (
                <View className="mt-4 gap-3.5">
                  <View>
                    <Text className="text-[12px] font-semibold text-gray-400">Full Name</Text>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder="Your full name"
                      className="mt-1 h-11 rounded-xl border border-primary/40 px-3.5 text-[15px] text-navy"
                    />
                  </View>
                  <View>
                    <Text className="text-[12px] font-semibold text-gray-400">Phone Number</Text>
                    <TextInput
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="Your phone number"
                      keyboardType="phone-pad"
                      className="mt-1 h-11 rounded-xl border border-primary/40 px-3.5 text-[15px] text-navy"
                    />
                  </View>
                </View>
              ) : (
                <View className="mt-3 gap-1.5">
                  <Text className="text-[16px] font-semibold text-navy">{name || "—"}</Text>
                  <Text className="text-[14px] text-gray-500">{phone || "—"}</Text>
                </View>
              )}
            </View>

            {/* Card 2: Booking Summary */}
            <View className="mt-4 rounded-3xl border border-slate-200/80 bg-sky/40 p-5 shadow-sm shadow-slate-100">
              <Text className="text-[15px] font-bold tracking-tight text-navy">
                Booking Summary
              </Text>

              <View className="mt-4 flex-row items-start gap-3.5">
                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary">
                  <AppIcon name="drop.fill" size={22} color="#FFFFFF" />
                </View>
                <View className="flex-1">
                  <Text className="text-[18px] font-extrabold text-navy">
                    {params.treatmentName}
                  </Text>
                  <View className="mt-1 flex-row items-center gap-2">
                    <View className="rounded-full bg-primary/20 px-2.5 py-0.5">
                      <Text className="text-[11px] font-bold text-primary-dark">
                        {params.durationMinutes} min
                      </Text>
                    </View>
                  </View>
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

            {/* Hold Policy Notice */}
            <View className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 flex-row items-start gap-2.5">
              <View className="mt-0.5">
                <AppIcon name="clock" size={14} color="#B45309" />
              </View>
              <Text className="flex-1 text-[13px] leading-[18px] text-amber-800">
                Your slot is held immediately upon submission. Our clinic team will confirm your appointment shortly.
              </Text>
            </View>

            {error && (
              <View className="mt-4 items-center">
                <Text className="text-center text-[13px] font-medium text-red-600">
                  {error.message}
                </Text>
                <Pressable onPress={handleErrorAction} className="mt-2">
                  <Text className="text-[13px] font-bold text-primary-dark">
                    {error.action === "retry-slot" ? "Choose another time" : "Start over"}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* CTA */}
            <View className="mt-8 mb-6">
              <Pressable
                onPress={handleConfirm}
                disabled={!canSubmit}
                className={`h-14 items-center justify-center rounded-full shadow-md ${
                  canSubmit ? "bg-primary shadow-primary/30" : "bg-gray-200 shadow-none"
                }`}
              >
                {status === "submitting" ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-[17px] font-bold text-white">Confirm Booking</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
