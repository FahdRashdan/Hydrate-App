import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { useAuth } from "@clerk/expo";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

const HYDRATE_LOGO = require("@/assets/images/hydrate-logo.png");

// Palette sampled from design/Name-phone-required.png
const BRAND_BLUE = "#406DA6";
const NAVY = "#0B3477";
const LABEL_GRAY = "#6B6B6B";
const SUBTITLE_GRAY = "#464545";

type ProfileOnboardingScreenProps = {
  // Called after a successful save. `index.tsx` renders this screen inline
  // (not via router navigation — see its profile-completeness check) and
  // uses this to flip straight to the signed-in view once the row is saved.
  onSaved?: () => void;
};

// First-time name/phone capture, shown once after sign-up before the customer
// home (PLAN.md Phase 2 — `(customer)/onboarding/profile.tsx` +
// `/api/profile+api.ts`). The home screen itself isn't built yet (Phase 3),
// so a successful save just hands back to `onSaved` instead of routing on.
export default function ProfileOnboardingScreen({ onSaved }: ProfileOnboardingScreenProps) {
  const { getToken } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const canContinue =
    firstName.trim().length > 0 && lastName.trim().length > 0 && phone.trim().length > 0;

  const handleContinue = async () => {
    if (!canContinue || status === "saving") return;
    setError(null);
    setStatus("saving");
    try {
      const token = await getToken();
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
        }),
      });
      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || `Request failed (${res.status})`);
      }
      setStatus("saved");
      onSaved?.();
    } catch (err) {
      console.error("Failed to save profile:", err);
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStatus("idle");
    }
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <SafeAreaView edges={["top", "bottom"]} className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <ScrollView
            className="flex-1"
            contentContainerClassName="flex-grow justify-center px-5 py-6"
            keyboardShouldPersistTaps="handled"
          >
            {/* Logo + welcome */}
            <View className="items-center">
              <Image source={HYDRATE_LOGO} className="h-16 w-44" resizeMode="contain" />
              <Text className="mt-1 text-[18px] font-semibold" style={{ color: NAVY }}>
                Welcome to Hydrate
              </Text>
            </View>

            {/* Heading */}
            <Text className="mt-10 text-[26px] font-extrabold leading-[32px] text-black">
              Let’s get started
            </Text>
            <Text className="mt-2 text-[15px] leading-[21px]" style={{ color: SUBTITLE_GRAY }}>
              This is a one-time step to book your treatment.
            </Text>

            {/* Fields */}
            <View className="mt-8 gap-5">
              <Field
                label="First name"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="John"
                autoCapitalize="words"
                textContentType="givenName"
              />
              <Field
                label="Last name"
                value={lastName}
                onChangeText={setLastName}
                placeholder="Doe"
                autoCapitalize="words"
                textContentType="familyName"
              />
              <Field
                label="Phone number"
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 (555) 123-4567"
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
              />
            </View>

            {/* CTA */}
            <Pressable
              onPress={handleContinue}
              disabled={!canContinue || status === "saving"}
              className="mt-10 h-14 items-center justify-center rounded-full"
              style={{ backgroundColor: BRAND_BLUE, opacity: canContinue ? 1 : 0.5 }}
            >
              {status === "saving" ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-[17px] font-semibold text-white">
                  {status === "saved" ? "Saved" : "Continue"}
                </Text>
              )}
            </Pressable>
            {error && (
              <Text className="mt-3 text-center text-[13px] font-medium text-red-600">
                {error}
              </Text>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  autoCapitalize?: "words" | "none";
  keyboardType?: TextInputProps["keyboardType"];
  textContentType?: TextInputProps["textContentType"];
};

function Field({ label, ...inputProps }: FieldProps) {
  return (
    <View>
      <Text className="mb-2 text-[14px] font-medium" style={{ color: LABEL_GRAY }}>
        {label}
      </Text>
      <TextInput
        {...inputProps}
        placeholderTextColor="#8A8A8E"
        className="h-11 rounded-xl border-2 px-4 text-[16px] text-black"
        style={{ borderColor: BRAND_BLUE }}
      />
    </View>
  );
}
