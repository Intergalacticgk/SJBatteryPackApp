import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          // Add any tab icon here if you want
        }}
      />
      {/* Add more tabs here if needed */}
    </Tabs>
  );
}
