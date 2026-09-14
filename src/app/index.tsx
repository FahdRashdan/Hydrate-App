import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
  Text,
  View,
} from "react-native";
import { useAuth, useSSO } from "@clerk/expo";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import ProfileOnboardingScreen from "@/app/onboarding/profile";

// Palette sampled from design/Auth-UI-Design.png
const NAVY = "#0B3477";
const TEAL = "#2FB1D6";
const BUTTON_BG = "#F4FAFE";
const DIVIDER = "rgba(15,58,110,0.22)";

const AUTH_BACKGROUND = require("@/assets/images/auth/auth-background.png");
const GOOGLE_ICON = require("@/assets/images/auth/google-icon.png");
const APPLE_ICON = require("@/assets/images/auth/apple-icon.png");

// Both providers go through browser SSO (works on iOS, Android, and web) with
// just the publishable key — no Google Cloud OAuth clients, no Apple Developer
// Program membership / native capability provisioning required.

// `JSON.stringify(error)` on a real Error yields "{}" — message/stack aren't
// enumerable — so pull the message out explicitly. Shown as-is in dev to make
// setup issues (missing env vars, provisioning, etc.) diagnosable; kept generic
// in production builds.
function describeAuthError(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: unknown }).message)
        : String(err);
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : undefined;
  const detail = code && !raw.includes(code) ? `${raw} (${code})` : raw;
  return __DEV__ ? detail : "Something went wrong. Please try again.";
}

type SocialButtonProps = {
  icon: number;
  label: string;
  iconClassName?: string;
  disabled?: boolean;
  onPress: () => void;
};

function SocialButton({ icon, label, iconClassName, disabled, onPress }: SocialButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="h-14 flex-row items-center justify-center rounded-full px-5 shadow-md shadow-black/20"
      style={{ backgroundColor: BUTTON_BG, opacity: disabled ? 0.6 : 1 }}
    >
      <Image source={icon} className={iconClassName} resizeMode="contain" />
      <View className="mx-4 h-6 w-px" style={{ backgroundColor: DIVIDER }} />
      <Text className="text-[17px] font-semibold" style={{ color: NAVY }}>
        {label}
      </Text>
    </Pressable>
  );
}

function SignInScreen() {
  const { startSSOFlow } = useSSO();
  const [pending, setPending] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setPending("google");
    try {
      const { createdSessionId, setActive, signUp } = await startSSOFlow({
        strategy: "oauth_google",
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      } else if (signUp?.status === "missing_requirements") {
        setError("Your Google account is missing info this app requires.");
      }
      // No createdSessionId and no missing requirements → user cancelled.
    } catch (err) {
      console.error("Google sign-in error:", describeAuthError(err));
      setError(describeAuthError(err));
    } finally {
      setPending(null);
    }
  };

  const handleAppleSignIn = async () => {
    setError(null);
    setPending("apple");
    try {
      const { createdSessionId, setActive, signUp } = await startSSOFlow({
        strategy: "oauth_apple",
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      } else if (signUp?.status === "missing_requirements") {
        setError("Your Apple account is missing info this app requires.");
      }
      // No createdSessionId and no missing requirements → user cancelled.
    } catch (err) {
      console.error("Apple sign-in error:", describeAuthError(err));
      setError(describeAuthError(err));
    } finally {
      setPending(null);
    }
  };

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />
      <ImageBackground source={AUTH_BACKGROUND} resizeMode="cover" className="flex-1">
        <SafeAreaView edges={["bottom"]} className="flex-1">
          {/* Spacer clears the photo + the "hydrate" wordmark baked into the background image */}
          <View className="h-[57%]" />

          <View className="px-8">
            <Text className="text-[34px] font-extrabold leading-[38px]" style={{ color: NAVY }}>
              Healthier hair,
            </Text>
            <Text className="text-[34px] font-extrabold leading-[38px]" style={{ color: TEAL }}>
              happier you.
            </Text>
            <Text
              className="mt-2 text-[16px] font-medium leading-[22px]"
              style={{ color: NAVY }}
            >
              Book your hair treatments{"\n"}in just a few taps.
            </Text>
          </View>

          <View className="mt-3 gap-2 px-8">
            <SocialButton
              icon={GOOGLE_ICON}
              iconClassName="h-6 w-6"
              label="Continue with Google"
              disabled={pending !== null}
              onPress={handleGoogleSignIn}
            />
            <SocialButton
              icon={APPLE_ICON}
              iconClassName="h-[26px] w-[22px]"
              label="Continue with Apple"
              disabled={pending !== null}
              onPress={handleAppleSignIn}
            />
            {pending !== null && (
              <ActivityIndicator color={NAVY} className="mt-1" />
            )}
            {error && (
              <Text className="mt-1 text-center text-xs font-semibold text-white">
                {error}
              </Text>
            )}
          </View>

          <View className="items-center px-10 pb-1 pt-4">
            <Text className="text-xs text-white/85">By continuing, you agree to our</Text>
            <Text className="text-xs font-semibold text-white">
              Terms of Service and Privacy Policy
            </Text>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

function ManagerPlaceholder() {
  // Manager dashboard (PLAN.md Phase 4) is out of scope for this build —
  // deliberately not a full route group, just enough to not strand a
  // manager-role account on a blank screen.
  const { signOut } = useAuth();

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-white px-8">
      <Text className="text-center text-xl font-bold" style={{ color: NAVY }}>
        Manager dashboard is not available in this build.
      </Text>
      <Pressable
        onPress={() => signOut()}
        className="h-12 items-center justify-center rounded-full px-8"
        style={{ backgroundColor: NAVY }}
      >
        <Text className="text-base font-semibold text-white">Sign out</Text>
      </Pressable>
    </View>
  );
}

type ProfileStatus = "checking" | "incomplete" | "customer" | "manager";

// Onboarding (`onboarding/profile.tsx`) collects `phone`, which Clerk never
// has (Google/Apple sign-in only) — so "has the profile row got a phone
// yet" is the only reliable "did they finish onboarding" signal, and it has
// to come from our own DB rather than `useUser()`. The same `/api/profile`
// response also carries `role`, which decides the customer/manager branch.
function useProfileStatus(isSignedIn: boolean | undefined): [ProfileStatus, () => void] {
  const { getToken } = useAuth();
  const [status, setStatus] = useState<ProfileStatus>("checking");

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch("/api/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (!res.ok) {
          // Row not created yet (Clerk webhook → Inngest sync can lag right
          // after sign-up) or a transient error — onboarding is the safer
          // default over getting stuck on a spinner.
          setStatus("incomplete");
          return;
        }
        const profile = await res.json();
        if (!profile.phone) {
          setStatus("incomplete");
        } else {
          setStatus(profile.role === "manager" ? "manager" : "customer");
        }
      } catch (err) {
        console.error("Failed to check profile status:", err);
        if (!cancelled) setStatus("incomplete");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken]);

  const markOnboarded = () => setStatus("customer");
  return [status, markOnboarded];
}

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();
  const [profileStatus, markOnboarded] = useProfileStatus(isSignedIn);

  useEffect(() => {
    if (profileStatus === "customer") {
      router.replace("/(customer)");
    }
  }, [profileStatus]);

  if (!isLoaded || (isSignedIn && (profileStatus === "checking" || profileStatus === "customer"))) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color={NAVY} />
      </View>
    );
  }

  if (!isSignedIn) return <SignInScreen />;

  if (profileStatus === "manager") return <ManagerPlaceholder />;

  return <ProfileOnboardingScreen onSaved={markOnboarded} />;
}
