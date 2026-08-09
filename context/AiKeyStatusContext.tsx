import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { testApiKey, testGeminiApiKey } from '../services/gemini';

export type RouterKeyState = 'unknown' | 'valid' | 'nocredit' | 'invalid';
export type GeminiKeyState = 'unknown' | 'valid' | 'invalid';

export interface RouterStatus {
    state: RouterKeyState;
    provider: string;
    error?: string;
}

export interface GeminiStatus {
    state: GeminiKeyState;
    error?: string;
}

interface AiKeyStatusContextType {
    router: RouterStatus;
    gemini: GeminiStatus;
    testing: boolean;
    lastChecked: number;
    aiAvailable: boolean;
    refresh: (routerKey?: string) => Promise<void>;
}

const AiKeyStatusContext = createContext<AiKeyStatusContextType | undefined>(undefined);

export const AiKeyStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [router, setRouter] = useState<RouterStatus>({ state: 'unknown', provider: '' });
    const [gemini, setGemini] = useState<GeminiStatus>({ state: 'unknown' });
    const [testing, setTesting] = useState(false);
    const [lastChecked, setLastChecked] = useState(0);
    const inFlight = useRef(false);

    const refresh = useCallback(async (routerKey?: string) => {
        if (inFlight.current) return;
        inFlight.current = true;
        setTesting(true);
        const key = (routerKey || '').trim() || import.meta.env.VITE_TOKENROUTER_API_KEY || import.meta.env.VITE_OPENROUTER_API_KEY || '';
        const [routerRes, geminiRes] = await Promise.all([
            key ? testApiKey(key) : Promise.resolve(null),
            testGeminiApiKey(),
        ]);
        setRouter(
            routerRes
                ? {
                      state: routerRes.ok ? (routerRes.quotaOk ? 'valid' : 'nocredit') : 'invalid',
                      provider: routerRes.provider,
                      error: routerRes.error,
                  }
                : { state: 'unknown', provider: '' }
        );
        setGemini({ state: geminiRes.ok ? 'valid' : 'invalid', error: geminiRes.error });
        setTesting(false);
        setLastChecked(Date.now());
        inFlight.current = false;
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const aiAvailable = router.state === 'valid' || gemini.state === 'valid';

    return (
        <AiKeyStatusContext.Provider value={{ router, gemini, testing, lastChecked, aiAvailable, refresh }}>
            {children}
        </AiKeyStatusContext.Provider>
    );
};

export function useAiKeyStatus(): AiKeyStatusContextType {
    const ctx = useContext(AiKeyStatusContext);
    if (!ctx) throw new Error('useAiKeyStatus must be used within an AiKeyStatusProvider');
    return ctx;
}
