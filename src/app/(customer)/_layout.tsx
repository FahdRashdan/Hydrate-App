import { useAuth } from "@clerk/expo";
import { Redirect } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";

// Deep-link safety net only — `index.tsx` already gates on
// signed-in/onboarded/role before ever routing here, so this layout doesn't
// re-check any of that, just "is there even a session".
export default function CustomerLayout() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/" />;

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="bookings">
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_today" />
        <NativeTabs.Trigger.Label>Bookings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon sf="person.fill" md="person" />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
