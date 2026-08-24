// app/index.tsx
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

export default function Index() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  // Set isReady after mount
  useEffect(() => {
    setIsReady(true);
  }, []);

  // Redirect to the new Drawer menu once ready!
  useEffect(() => {
    if (isReady) {
      router.replace('/(drawer)'); 
    }
  }, [isReady, router]);

  return null;
}