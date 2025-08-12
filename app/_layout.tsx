// app/_layout.tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      {/* This will render the tabs navigator */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* Not Found Screen */}
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
