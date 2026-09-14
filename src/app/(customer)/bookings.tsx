import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useAuth } from "@clerk/expo";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

import { authedFetchJson } from "@/lib/api/client";
import { Colors } from "@/lib/theme/colors";
import { formatDisplayDate, formatDisplayTime } from "@/lib/time/format";
import { AppIcon } from "@/lib/ui/icon";

type BookingStatus = "pending" | "confirmed" | "cancelled";

type MyBooking = {
  id: string;
  status: BookingStatus;
  date: string;
  startTime: string;
  endTime: string;
  treatmentId?: string;
  treatmentName: string;
  createdAt: string;
};

const STATUS_CONFIG: Record<
  BookingStatus,
  {
    label: string;
    bg: string;
    text: string;
    border: string;
    dot: string;
  }
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

export default function CustomerBookingsScreen() {
  const { getToken } = useAuth();
  const [bookings, setBookings] = useState<MyBooking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");

  const load = useCallback(async () => {
    try {
      const rows = await authedFetchJson<MyBooking[]>(getToken, "/api/bookings/me");
      setBookings(rows);
      setError(null);
    } catch (err) {
      console.error("Failed to load bookings:", err);
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

  const upcomingBookings =
    bookings?.filter((b) => b.status !== "cancelled" && b.date >= todayStr) ?? [];
  const pastBookings =
    bookings?.filter((b) => b.status === "cancelled" || b.date < todayStr) ?? [];

  const displayedBookings = activeTab === "upcoming" ? upcomingBookings : pastBookings;

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <SafeAreaView edges={["top", "bottom"]} className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 py-6 pb-12"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-[28px] font-extrabold tracking-tight text-navy">
                My Bookings
              </Text>
              <Text className="mt-1 text-[15px] font-medium text-slate-500">
                Track and manage your appointments
              </Text>
            </View>
          </View>

          {/* Luxury Segmented Control */}
          <View className="mt-6 flex-row rounded-2xl bg-slate-100/90 p-1.5">
            <Pressable
              onPress={() => setActiveTab("upcoming")}
              className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-2.5 ${
                activeTab === "upcoming" ? "bg-white shadow-xs" : ""
              }`}
            >
              <Text
                className={`text-[14px] ${
                  activeTab === "upcoming"
                    ? "font-bold text-navy"
                    : "font-medium text-slate-500"
                }`}
              >
                Upcoming
              </Text>
              <View
                className={`rounded-full px-2 py-0.5 ${
                  activeTab === "upcoming" ? "bg-primary/15" : "bg-slate-200/60"
                }`}
              >
                <Text
                  className={`text-[11px] font-bold ${
                    activeTab === "upcoming" ? "text-primary-dark" : "text-slate-500"
                  }`}
                >
                  {upcomingBookings.length}
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("past")}
              className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-2.5 ${
                activeTab === "past" ? "bg-white shadow-xs" : ""
              }`}
            >
              <Text
                className={`text-[14px] ${
                  activeTab === "past"
                    ? "font-bold text-navy"
                    : "font-medium text-slate-500"
                }`}
              >
                Past Visits
              </Text>
              <View
                className={`rounded-full px-2 py-0.5 ${
                  activeTab === "past" ? "bg-primary/15" : "bg-slate-200/60"
                }`}
              >
                <Text
                  className={`text-[11px] font-bold ${
                    activeTab === "past" ? "text-primary-dark" : "text-slate-500"
                  }`}
                >
                  {pastBookings.length}
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Bookings Content */}
          <View className="mt-6">
            {bookings === null && !error ? (
              <View key="bookings-loading" className="py-14 items-center">
                <ActivityIndicator color={Colors.NAVY} size="large" />
              </View>
            ) : error ? (
              <View key="bookings-error" className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <Text className="text-center text-[14px] font-medium text-red-600">{error}</Text>
              </View>
            ) : displayedBookings.length === 0 ? (
              activeTab === "upcoming" ? (
                <View
                  key="bookings-empty-upcoming"
                  className="items-center rounded-3xl border border-slate-200/70 bg-sky/30 px-6 py-12"
                >
                  <View className="h-16 w-16 items-center justify-center rounded-3xl bg-primary/15">
                    <AppIcon name="calendar" size={28} color={Colors.PRIMARY} />
                  </View>
                  <Text className="mt-5 text-[20px] font-extrabold text-navy">
                    No Upcoming Appointments
                  </Text>
                  <Text className="mt-2 text-center text-[14px] leading-[21px] text-slate-500 max-w-[280px]">
                    Ready to feel refreshed? Schedule your next IV therapy or scalp wellness treatment in a few taps.
                  </Text>
                  <Pressable
                    onPress={() => router.push("/booking/treatment")}
                    className="mt-6 h-14 px-8 items-center justify-center rounded-full bg-primary shadow-md shadow-primary/35 flex-row gap-2.5 active:opacity-90"
                  >
                    <Text className="text-[16px] font-extrabold text-white">Book a Treatment</Text>
                    <AppIcon name="arrow.right" size={15} color="#FFFFFF" />
                  </Pressable>
                </View>
              ) : (
                <View
                  key="bookings-empty-past"
                  className="items-center rounded-3xl border border-slate-200/70 bg-slate-50/70 px-6 py-12"
                >
                  <View className="h-16 w-16 items-center justify-center rounded-3xl bg-slate-200/60">
                    <AppIcon name="clock" size={28} color={Colors.LABEL_GRAY} />
                  </View>
                  <Text className="mt-5 text-[20px] font-extrabold text-navy">
                    No Past Appointments
                  </Text>
                  <Text className="mt-2 text-center text-[14px] leading-[21px] text-slate-500 max-w-[280px]">
                    Your completed appointments and treatment history will appear here once fulfilled.
                  </Text>
                </View>
              )
            ) : (
              <View key="bookings-list" className="gap-4">
                {displayedBookings.map((booking) => {
                  const cfg = STATUS_CONFIG[booking.status];
                  return (
                    <View
                      key={booking.id}
                      className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs"
                    >
                      {/* Top Header: Treatment Icon, Title, Status Pill */}
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center flex-1 pr-2">
                          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 mr-3">
                            <AppIcon name="drop.fill" size={20} color={Colors.PRIMARY} />
                          </View>
                          <View className="flex-1">
                            <Text className="text-[17px] font-bold text-navy" numberOfLines={1}>
                              {booking.treatmentName}
                            </Text>
                            <Text className="mt-0.5 text-[12px] font-medium text-slate-500">
                              Hydrate Clinic Session
                            </Text>
                          </View>
                        </View>

                        {/* Status Badge with dot */}
                        <View
                          className="flex-row items-center rounded-full border px-2.5 py-1"
                          style={{
                            backgroundColor: cfg.bg,
                            borderColor: cfg.border,
                          }}
                        >
                          <View
                            className="h-1.5 w-1.5 rounded-full mr-1.5"
                            style={{ backgroundColor: cfg.dot }}
                          />
                          <Text
                            className="text-[11px] font-bold uppercase tracking-wider"
                            style={{ color: cfg.text }}
                          >
                            {cfg.label}
                          </Text>
                        </View>
                      </View>

                      {/* Info Inset Box: Date, Time, Location */}
                      <View className="mt-4 rounded-2xl bg-slate-50/90 border border-slate-100 p-3.5 gap-2.5">
                        <View className="flex-row items-center gap-2.5">
                          <AppIcon name="calendar" size={15} color={Colors.LABEL_GRAY} />
                          <Text className="text-[14px] font-semibold text-navy">
                            {formatDisplayDate(booking.date)}
                          </Text>
                          <Text className="text-[13px] text-slate-400">·</Text>
                          <Text className="text-[13px] font-medium text-slate-600">
                            {formatDisplayTime(booking.startTime)}
                            {booking.endTime ? ` – ${formatDisplayTime(booking.endTime)}` : ""}
                          </Text>
                        </View>

                        <View className="flex-row items-center gap-2.5">
                          <AppIcon name="mappin.and.ellipse" size={15} color={Colors.LABEL_GRAY} />
                          <Text className="text-[13px] text-slate-600">
                            Hydrate — Main Location
                          </Text>
                        </View>
                      </View>

                      {/* Status Announcement Banner */}
                      {booking.status === "pending" && (
                        <View className="mt-3.5 flex-row items-start gap-2.5 rounded-2xl border border-amber-200/70 bg-amber-50/70 p-3">
                          <View className="mt-0.5">
                            <AppIcon name="clock" size={14} color="#B45309" />
                          </View>
                          <Text className="flex-1 text-[13px] leading-[18px] text-amber-800">
                            Your slot is held. Our medical team will confirm your appointment shortly.
                          </Text>
                        </View>
                      )}

                      {booking.status === "confirmed" && (
                        <View className="mt-3.5 flex-row items-start gap-2.5 rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-3">
                          <View className="mt-0.5">
                            <AppIcon name="checkmark.circle.fill" size={14} color="#15803D" />
                          </View>
                          <Text className="flex-1 text-[13px] leading-[18px] text-emerald-800">
                            Appointment confirmed. Please arrive 10 minutes prior to your session.
                          </Text>
                        </View>
                      )}

                      {/* Footer Actions */}
                      <View className="mt-4 flex-row items-center justify-between border-t border-slate-100 pt-3">
                        <Text className="text-[12px] text-slate-400">
                          Need changes? Contact clinic
                        </Text>

                        {activeTab === "past" ? (
                          <Pressable
                            onPress={() =>
                              booking.treatmentId
                                ? router.push({
                                    pathname: "/booking/date",
                                    params: {
                                      treatmentId: booking.treatmentId,
                                      treatmentName: booking.treatmentName,
                                      durationMinutes: "60",
                                    },
                                  })
                                : router.push("/booking/treatment")
                            }
                            className="rounded-full bg-primary px-4 py-1.5 shadow-xs"
                          >
                            <Text className="text-[12px] font-bold text-white">Book Again</Text>
                          </Pressable>
                        ) : (
                          <Pressable
                            onPress={() => router.push("/booking/treatment")}
                            className="rounded-full bg-navy px-3.5 py-1.5"
                          >
                            <Text className="text-[12px] font-bold text-white">New Booking</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Clinic Assistance Footer Card */}
          <View className="mt-8 rounded-2xl bg-slate-50 border border-slate-100 p-4">
            <View className="flex-row items-center gap-2">
              <AppIcon name="info.circle" size={16} color={Colors.NAVY} />
              <Text className="text-[14px] font-bold text-navy">Hydrate Concierge</Text>
            </View>
            <Text className="mt-1 text-[13px] leading-[18px] text-slate-500">
              For same-day adjustments or group appointments, our clinic team is available daily 9:00 AM – 6:00 PM.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
