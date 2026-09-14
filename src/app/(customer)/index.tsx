import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useAuth, useUser } from "@clerk/expo";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

import { authedFetchJson } from "@/lib/api/client";
import { Colors } from "@/lib/theme/colors";
import { formatDisplayDateTime } from "@/lib/time/format";
import { AppIcon } from "@/lib/ui/icon";

type BookingStatus = "pending" | "confirmed" | "cancelled";

type MyBooking = {
  id: string;
  status: BookingStatus;
  date: string;
  startTime: string;
  endTime: string;
  treatmentName: string;
};

type Treatment = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
};

type Profile = {
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
};

const STATUS_CONFIG: Record<
  BookingStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  pending: {
    label: "Pending",
    bg: "#FFFBEB",
    text: "#B45309",
    border: "#FDE68A",
    dot: "#F59E0B",
  },
  confirmed: {
    label: "Confirmed",
    bg: "#F0FDF4",
    text: "#15803D",
    border: "#BBF7D0",
    dot: "#22C55E",
  },
  cancelled: {
    label: "Cancelled",
    bg: "#FEF2F2",
    text: "#B91C1C",
    border: "#FECACA",
    dot: "#EF4444",
  },
};

function getTimeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function CustomerHome() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bookings, setBookings] = useState<MyBooking[] | null>(null);
  const [treatments, setTreatments] = useState<Treatment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [bookingsData, treatmentsData, profileData] = await Promise.all([
        authedFetchJson<MyBooking[]>(getToken, "/api/bookings/me"),
        authedFetchJson<Treatment[]>(getToken, "/api/treatments"),
        authedFetchJson<Profile>(getToken, "/api/profile").catch(() => null),
      ]);
      setBookings(bookingsData);
      setTreatments(treatmentsData);
      if (profileData) setProfile(profileData);
      setError(null);
    } catch (err) {
      console.error("Failed to load home data:", err);
      setError("Couldn't load your bookings. Pull down to try again.");
    }
  }, [getToken]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const currentBooking =
    bookings?.find((b) => b.status !== "cancelled" && b.date >= todayStr) ?? null;

  const greeting = getTimeOfDayGreeting();

  // Name resolution: Prioritize user's real first name from database profile.
  // Never display the raw email handle prefix if user.firstName matches the email username.
  const emailPrefix = user?.primaryEmailAddress?.emailAddress?.split("@")[0]?.toLowerCase();
  let resolvedFirstName = profile?.firstName?.trim();
  if (!resolvedFirstName && user?.firstName) {
    const rawClerkName = user.firstName.trim();
    if (!emailPrefix || rawClerkName.toLowerCase() !== emailPrefix) {
      resolvedFirstName = rawClerkName;
    }
  }
  const firstName = resolvedFirstName || "there";

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <SafeAreaView edges={["top", "bottom"]} className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 py-6 pb-14"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Personalized Greeting */}
          <View>
            <Text className="text-[28px] font-extrabold tracking-tight text-navy">
              {`${greeting}, ${firstName}`}
            </Text>
            <Text className="mt-1 text-[15px] font-medium text-slate-500">
              Physician-formulated IV therapies & scalp wellness
            </Text>
          </View>

          {/* Upcoming Booking Card or Luxury Hero Showcase */}
          <View className="mt-6">
            {bookings === null && !error ? (
              <View key="hero-loading" className="py-12 items-center justify-center">
                <ActivityIndicator color={Colors.NAVY} size="large" />
              </View>
            ) : error ? (
              <View key="hero-error" className="rounded-3xl border border-red-200 bg-red-50 p-5">
                <Text className="text-center text-[14px] font-medium text-red-600">{error}</Text>
              </View>
            ) : currentBooking ? (
              <View
                key="hero-current"
                className="rounded-3xl border border-primary/25 bg-sky/60 p-5 shadow-xs"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View className="h-2 w-2 rounded-full bg-primary" />
                    <Text className="text-[12px] font-bold uppercase tracking-wider text-primary-dark">
                      Upcoming Appointment
                    </Text>
                  </View>
                  <View
                    className="flex-row items-center rounded-full border px-2.5 py-0.5"
                    style={{
                      backgroundColor: STATUS_CONFIG[currentBooking.status].bg,
                      borderColor: STATUS_CONFIG[currentBooking.status].border,
                    }}
                  >
                    <View
                      className="h-1.5 w-1.5 rounded-full mr-1.5"
                      style={{ backgroundColor: STATUS_CONFIG[currentBooking.status].dot }}
                    />
                    <Text
                      className="text-[11px] font-bold uppercase"
                      style={{ color: STATUS_CONFIG[currentBooking.status].text }}
                    >
                      {STATUS_CONFIG[currentBooking.status].label}
                    </Text>
                  </View>
                </View>

                <Text className="mt-3 text-[21px] font-extrabold text-navy">
                  {currentBooking.treatmentName}
                </Text>

                <View className="mt-3 rounded-2xl bg-white/80 p-3.5 gap-2 border border-primary/10">
                  <View className="flex-row items-center gap-2.5">
                    <AppIcon name="clock" size={15} color={Colors.LABEL_GRAY} />
                    <Text className="text-[14px] font-semibold text-slate-700">
                      {formatDisplayDateTime(currentBooking.date, currentBooking.startTime)}
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-2.5">
                    <AppIcon name="mappin.and.ellipse" size={15} color={Colors.LABEL_GRAY} />
                    <Text className="text-[13px] text-slate-500">
                      Hydrate — Main Location
                    </Text>
                  </View>
                </View>

                <View className="mt-4 flex-row items-center justify-between border-t border-primary/10 pt-3">
                  <Pressable onPress={() => router.push("/(customer)/bookings")}>
                    <Text className="text-[14px] font-bold text-primary-dark">
                      View details
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => router.push("/booking/treatment")}
                    className="rounded-full bg-navy px-4 py-2"
                  >
                    <Text className="text-[13px] font-bold text-white">Book Another</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View
                key="hero-empty"
                className="rounded-3xl border border-slate-200/80 bg-sky/50 p-6 shadow-xs"
              >
                <View className="flex-row items-center gap-2">
                  <View className="rounded-full bg-primary/20 px-2.5 py-0.5">
                    <Text className="text-[11px] font-bold uppercase tracking-wider text-primary-dark">
                      Wellness Lounge
                    </Text>
                  </View>
                </View>

                <Text className="mt-3 text-[22px] font-extrabold leading-[28px] text-navy">
                  Restore. Revitalize. Hydrate.
                </Text>
                <Text className="mt-2 text-[14px] leading-[21px] text-slate-600">
                  Experience medical-grade IV infusions and scalp restoration therapies customized to your health goals.
                </Text>

                <Pressable
                  onPress={() => router.push("/booking/treatment")}
                  className="mt-6 h-[60px] w-full flex-row items-center justify-center gap-2.5 rounded-full bg-primary shadow-md shadow-primary/35 active:opacity-90"
                >
                  <Text className="text-[17px] font-extrabold tracking-wide text-white">
                    Book a Treatment
                  </Text>
                  <AppIcon name="arrow.right" size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            )}
          </View>

          {/* Quick Treatment Showcase */}
          <View className="mt-8">
            <View className="flex-row items-center justify-between">
              <Text className="text-[20px] font-extrabold text-navy">
                Signature Treatments
              </Text>
              <Pressable onPress={() => router.push("/booking/treatment")}>
                <Text className="text-[14px] font-bold text-primary-dark">See all</Text>
              </Pressable>
            </View>

            <View className="mt-4 gap-3">
              {treatments?.map((treatment) => (
                <Pressable
                  key={treatment.id}
                  onPress={() =>
                    router.push({
                      pathname: "/booking/date",
                      params: {
                        treatmentId: treatment.id,
                        treatmentName: treatment.name,
                        durationMinutes: String(treatment.durationMinutes),
                      },
                    })
                  }
                  className="flex-row items-center justify-between rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs"
                >
                  <View className="flex-row items-center flex-1 pr-3">
                    <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 mr-3.5">
                      <AppIcon name="drop.fill" size={20} color={Colors.PRIMARY} />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-[16px] font-bold text-navy">{treatment.name}</Text>
                        <View className="rounded-full bg-slate-100 px-2 py-0.5">
                          <Text className="text-[11px] font-bold text-slate-600">
                            {treatment.durationMinutes} min
                          </Text>
                        </View>
                      </View>
                      {treatment.description && (
                        <Text
                          className="mt-1 text-[13px] leading-[18px] text-slate-500"
                          numberOfLines={2}
                        >
                          {treatment.description}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View className="h-9 w-9 items-center justify-center rounded-full bg-slate-100">
                    <AppIcon name="arrow.right" size={13} color={Colors.NAVY} />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Clinic Location & Hours Card */}
          <View className="mt-8 rounded-3xl border border-slate-200/80 bg-slate-50/80 p-5">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <AppIcon name="mappin.and.ellipse" size={16} color={Colors.NAVY} />
                <Text className="text-[15px] font-bold text-navy">Hydrate — Main Location</Text>
              </View>
              <View className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5">
                <Text className="text-[10px] font-bold uppercase text-emerald-700">Open Today</Text>
              </View>
            </View>
            <Text className="mt-1.5 text-[13px] text-slate-500">
              Cairo, Egypt · Daily 9:00 AM – 6:00 PM
            </Text>
            <Text className="mt-0.5 text-[12px] text-slate-400">
              Walk-in consultations welcome based on availability
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
