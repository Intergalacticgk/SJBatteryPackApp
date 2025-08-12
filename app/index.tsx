import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

export default function Index() {
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Simulate a delay to ensure the root layout is mounted
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100); // Adjust the delay as needed

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isReady) {
      router.replace('(tabs)/index');
    }
  }, [isReady, router]);

  return null;
}
