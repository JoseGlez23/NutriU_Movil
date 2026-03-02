import React, { createContext, useState, useContext, ReactNode } from 'react';

interface PointsContextType {
  userPoints: number;
  todayPoints: number;
  addPoints: (points: number) => void;
  resetTodayPoints: () => void;
  foodHistory: any[];
  addFoodToHistory: (food: any) => void;
}

const PointsContext = createContext<PointsContextType | undefined>(undefined);

interface PointsProviderProps {
  children: ReactNode;
}

export const PointsProvider: React.FC<PointsProviderProps> = ({ children }) => {
  const [userPoints, setUserPoints] = useState(185); // Puntos iniciales
  const [todayPoints, setTodayPoints] = useState(0);
  const [foodHistory, setFoodHistory] = useState<any[]>([]);

  const addPoints = (points: number) => {
    setUserPoints(prev => prev + points);
    setTodayPoints(prev => prev + points);
  };

  const resetTodayPoints = () => {
    setTodayPoints(0);
  };

  const addFoodToHistory = (food: any) => {
    setFoodHistory(prev => [food, ...prev]);
  };

  return (
    <PointsContext.Provider value={{
      userPoints,
      todayPoints,
      addPoints,
      resetTodayPoints,
      foodHistory,
      addFoodToHistory
    }}>
      {children}
    </PointsContext.Provider>
  );
};

export const usePoints = () => {
  const context = useContext(PointsContext);
  if (context === undefined) {
    throw new Error('usePoints must be used within a PointsProvider');
  }
  return context;
};