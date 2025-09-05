// app/lib/HomeContext.tsx
"use client";
import { createContext, useContext } from "react";

type HomeContextType = { resetHome?: () => void };

export const HomeContext = createContext<HomeContextType>({});
export const useHome = () => useContext(HomeContext);
