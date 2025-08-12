import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    // You must render <Slot /> or a navigator here so children routes can mount
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
