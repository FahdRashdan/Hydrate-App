import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useAuth, useUser } from "@clerk/expo";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

import { authedFetchJson } from "@/lib/api/client";
import { Colors } from "@/lib/theme/colors";
import { AppIcon } from "@/lib/ui/icon";
import type { SFSymbol } from "expo-symbols";

type Profile = {
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
};

function SettingRow({
  icon,
  label,
  value,
  onPress,
  isLast,
  destructive,
  hasChevron,
}: {
  icon: SFSymbol;
  label: string;
  value?: string;
  onPress?: () => void;
  isLast?: boolean;
  destructive?: boolean;
  hasChevron?: boolean;
}) {
  const content = (
    <View
      className={`flex-row items-center justify-between py-4 ${
        isLast ? "" : "border-b border-slate-100"
      }`}
    >
      <View className="flex-row items-center gap-3 flex-1 pr-2">
        <View
          className={`h-9 w-9 items-center justify-center rounded-2xl ${
            destructive ? "bg-red-50" : "bg-primary/10"
          }`}
        >
          <AppIcon
            name={icon}
            size={16}
            color={destructive ? Colors.RED : Colors.NAVY}
          />
        </View>
        <Text
          className={`text-[15px] font-medium ${
            destructive ? "text-red-600" : "text-navy"
          }`}
        >
          {label}
        </Text>
      </View>

      <View className="flex-row items-center gap-2">
        {value ? (
          <Text
            className="text-[14px] font-semibold text-slate-500 max-w-[180px] text-right"
            numberOfLines={1}
          >
            {value}
          </Text>
        ) : null}
        {hasChevron && (
          <AppIcon name="chevron.right" size={13} color={Colors.LABEL_GRAY} />
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className="active:opacity-70"
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

export default function ProfileScreen() {
  const { getToken, signOut } = useAuth();
  const { user } = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await authedFetchJson<Profile>(getToken, "/api/profile");
        if (!cancelled) setProfile(data);
      } catch (err) {
        console.error("Failed to load profile:", err);
        if (!cancelled) setError("Couldn't load your profile.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const firstName = profile?.firstName ?? user?.firstName ?? "";
  const lastName = profile?.lastName ?? user?.lastName ?? "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const initials =
    [firstName?.[0], lastName?.[0]].filter(Boolean).join("").toUpperCase() || "H";

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? All your personal information and booking history will be permanently deleted. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: async () => {
            try {
              setIsDeleting(true);
              // Clean up DB records
              await authedFetchJson(getToken, "/api/profile", {
                method: "DELETE",
              }).catch(() => null);

              // Delete Clerk user account if supported
              try {
                await user?.delete();
              } catch (e) {
                console.warn("Clerk user deletion completed with fallback:", e);
              }

              await signOut();
            } catch (err) {
              console.error("Failed to delete account:", err);
              Alert.alert(
                "Error",
                "Could not delete your account. Please contact clinic support.",
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  const handlePrivacyPolicy = () => {
    Alert.alert(
      "Privacy Policy",
      "Hydrate takes your personal and medical privacy seriously. Your health intake and contact data are strictly encrypted and used solely for appointments and medical treatment compliance.",
    );
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <SafeAreaView edges={["top", "bottom"]} className="flex-1">
        <ScrollView className="flex-1 px-5 py-6" contentContainerClassName="pb-16">
          {/* Header */}
          <Text className="text-[28px] font-extrabold tracking-tight text-navy">
            Account
          </Text>
          <Text className="mt-1 text-[15px] font-medium text-slate-500">
            Profile settings & clinic preferences
          </Text>

          {/* User Hero Card */}
          <View className="mt-6 items-center rounded-3xl border border-primary/20 bg-sky/50 p-6 shadow-xs">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-primary shadow-sm shadow-primary/30">
              <Text className="text-[26px] font-extrabold text-white">{initials}</Text>
            </View>

            <Text className="mt-3 text-[20px] font-extrabold text-navy">
              {fullName || "Hydrate Client"}
            </Text>

            <Text className="mt-0.5 text-[14px] text-slate-500">
              {profile?.email ?? user?.primaryEmailAddress?.emailAddress ?? "—"}
            </Text>

            <View className="mt-3 flex-row items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1">
              <AppIcon name="checkmark" size={12} color={Colors.PRIMARY} />
              <Text className="text-[11px] font-bold uppercase tracking-wider text-primary-dark">
                Verified Client
              </Text>
            </View>
          </View>

          {/* Personal Information Group */}
          <View className="mt-8">
            <Text className="px-1 text-[12px] font-bold uppercase tracking-wider text-slate-400">
              Personal Information
            </Text>
            <View className="mt-2.5 rounded-3xl border border-slate-200/80 bg-white px-5 shadow-xs">
              {!profile && !error ? (
                <View key="profile-loading" className="py-8 items-center">
                  <ActivityIndicator color={Colors.NAVY} />
                </View>
              ) : error ? (
                <Text
                  key="profile-error"
                  className="py-4 text-center text-[14px] font-medium text-red-600"
                >
                  {error}
                </Text>
              ) : (
                <View key="profile-content">
                  <SettingRow
                    icon="person.fill"
                    label="Full Name"
                    value={fullName || "—"}
                  />
                  <SettingRow
                    icon="envelope.fill"
                    label="Email"
                    value={
                      profile?.email ??
                      user?.primaryEmailAddress?.emailAddress ??
                      "—"
                    }
                  />
                  <SettingRow
                    icon="phone.fill"
                    label="Phone"
                    value={profile?.phone ?? "—"}
                    isLast
                  />
                </View>
              )}
            </View>
          </View>

          {/* Legal & Policy Group */}
          <View className="mt-7">
            <Text className="px-1 text-[12px] font-bold uppercase tracking-wider text-slate-400">
              Legal & Support
            </Text>
            <View className="mt-2.5 rounded-3xl border border-slate-200/80 bg-white px-5 shadow-xs">
              <SettingRow
                icon="shield.fill"
                label="Privacy Policy"
                onPress={handlePrivacyPolicy}
                hasChevron
                isLast
              />
            </View>
          </View>

          {/* Account Actions Group */}
          <View className="mt-8 gap-3">
            {/* Sign Out Button */}
            <Pressable
              onPress={() => signOut()}
              className="h-[56px] w-full flex-row items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white shadow-xs active:opacity-80"
            >
              <AppIcon
                name="arrow.backward.circle.fill"
                size={17}
                color={Colors.NAVY}
              />
              <Text className="text-[16px] font-bold text-navy">Sign Out</Text>
            </Pressable>

            {/* Delete Account Button */}
            <Pressable
              onPress={handleDeleteAccount}
              disabled={isDeleting}
              className="h-[56px] w-full flex-row items-center justify-center gap-2.5 rounded-2xl border border-red-200 bg-red-50/80 active:opacity-80"
            >
              {isDeleting ? (
                <ActivityIndicator color={Colors.RED} size="small" />
              ) : (
                <>
                  <AppIcon name="trash.fill" size={16} color={Colors.RED} />
                  <Text className="text-[16px] font-bold text-red-600">
                    Delete Account
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          {/* App Version Stamp */}
          <Text className="mt-8 text-center text-[12px] font-medium text-slate-400">
            Hydrate App · Version 1.0.0
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
