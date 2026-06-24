/**
 * BetSlipContext
 * Global parlay bet slip — shared across all tabs.
 *
 * Each leg has:
 *   id         — unique key (auto-generated)
 *   player     — player name or game label
 *   market     — e.g. "batter_hits", "h2h", "spreads"
 *   selection  — e.g. "O 1.5", "NYY -1.5", "YRFI"
 *   odds       — American odds (number)
 *   game       — e.g. "NYY @ BOS"
 *   addedAt    — timestamp
 */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface BetLeg {
  id: string;
  player: string;
  market: string;
  selection: string;
  odds: number;
  game: string;
  addedAt: number;
}

interface BetSlipContextValue {
  legs: BetLeg[];
  addLeg: (leg: Omit<BetLeg, 'id' | 'addedAt'>) => void;
  removeLeg: (id: string) => void;
  clearLegs: () => void;
  hasLeg: (player: string, market: string, selection: string) => boolean;
  combinedOdds: number;          // American combined parlay odds
  impliedProbability: number;    // 0–1
  payoutFor: (stake: number) => number;
}

// ── Odds math ─────────────────────────────────────────────────────────────────

/** Convert American odds to decimal multiplier */
function americanToDecimal(american: number): number {
  if (american > 0) return american / 100 + 1;
  return 100 / Math.abs(american) + 1;
}

/** Convert decimal multiplier back to American odds */
function decimalToAmerican(decimal: number): number {
  if (decimal >= 2) return Math.round((decimal - 1) * 100);
  return Math.round(-100 / (decimal - 1));
}

/** Combined parlay odds from an array of American odds */
export function calcParlayOdds(oddsArr: number[]): number {
  if (oddsArr.length === 0) return 0;
  const combined = oddsArr.reduce((acc, o) => acc * americanToDecimal(o), 1);
  return decimalToAmerican(combined);
}

/** Implied probability from American odds (0–1) */
export function impliedProb(american: number): number {
  const dec = americanToDecimal(american);
  return 1 / dec;
}

/** Payout for a given stake (returns profit, not total return) */
export function calcPayout(american: number, stake: number): number {
  const dec = americanToDecimal(american);
  return parseFloat(((dec - 1) * stake).toFixed(2));
}

// ── Context ───────────────────────────────────────────────────────────────────

const BetSlipContext = createContext<BetSlipContextValue | null>(null);

export function BetSlipProvider({ children }: { children: ReactNode }) {
  const [legs, setLegs] = useState<BetLeg[]>([]);

  const addLeg = useCallback((leg: Omit<BetLeg, 'id' | 'addedAt'>) => {
    setLegs(prev => {
      // Prevent duplicate: same player + market + selection
      const isDupe = prev.some(
        l => l.player === leg.player && l.market === leg.market && l.selection === leg.selection
      );
      if (isDupe) return prev;
      return [
        ...prev,
        { ...leg, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, addedAt: Date.now() },
      ];
    });
  }, []);

  const removeLeg = useCallback((id: string) => {
    setLegs(prev => prev.filter(l => l.id !== id));
  }, []);

  const clearLegs = useCallback(() => setLegs([]), []);

  const hasLeg = useCallback(
    (player: string, market: string, selection: string) =>
      legs.some(l => l.player === player && l.market === market && l.selection === selection),
    [legs]
  );

  const combinedOdds = legs.length > 0 ? calcParlayOdds(legs.map(l => l.odds)) : 0;
  const impliedProbability = legs.length > 0 ? impliedProb(combinedOdds) : 0;
  const payoutFor = useCallback(
    (stake: number) => calcPayout(combinedOdds, stake),
    [combinedOdds]
  );

  return (
    <BetSlipContext.Provider
      value={{ legs, addLeg, removeLeg, clearLegs, hasLeg, combinedOdds, impliedProbability, payoutFor }}
    >
      {children}
    </BetSlipContext.Provider>
  );
}

export function useBetSlip(): BetSlipContextValue {
  const ctx = useContext(BetSlipContext);
  if (!ctx) throw new Error('useBetSlip must be used inside BetSlipProvider');
  return ctx;
}
