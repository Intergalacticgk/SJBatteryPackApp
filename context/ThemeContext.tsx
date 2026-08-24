import React, { createContext, useContext, useState } from 'react';

export interface ThemeColors {
  isDark: boolean;
  bg: string;
  cardBg: string;
  subCardBg: string;
  text: string;
  subText: string;
  accentGold: string;
  accentOrange: string;
  borderColor: string;
}

const darkTheme: ThemeColors = {
  isDark: true,
  bg: '#001417',
  cardBg: '#001E22',
  subCardBg: '#002F35',
  text: '#FFFFFF',
  subText: '#80B3B8',
  accentGold: '#FFB800',
  accentOrange: '#DD8943',
  borderColor: 'rgba(255,184,0,0.25)',
};

const lightTheme: ThemeColors = {
  isDark: false,
  bg: '#F4F7F8',
  cardBg: '#FFFFFF',
  subCardBg: '#E6ECEE',
  text: '#001E22',
  subText: '#4A6B70',
  accentGold: '#D49200',
  accentOrange: '#DD8943',
  borderColor: '#D0DADC',
};

const ThemeContext = createContext<{
  theme: ThemeColors;
  toggleTheme: () => void;
}>({
  theme: darkTheme,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  const toggleTheme = () => setIsDark((prev) => !prev);
  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useAppTheme = () => useContext(ThemeContext);