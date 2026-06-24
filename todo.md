
## Round 4 — UI + Features

- [x] Enlarge tab bar items (bigger icons + labels, more padding)
- [x] Add light/dark mode toggle button in top-right header
- [x] Build FanDuel-style Hits/HR/Ks prop layout (player row, threshold columns, soft navy bg)
- [x] Add YRFI and First Five bet types to prop system
- [x] Connect weather + lineups into Books Research drawer (Pitcher Props + Inning Splits)
- [x] Build lineup-confirmed push notification system

## Round 5 — Player Detail Panel (FanDuel-style)

- [x] PlayerDetailPanel: season stats header (Games, AVG/ERA, HR/W-L, RBI/SO, OPS/WHIP)
- [x] PlayerDetailPanel: last-5 game bar chart with opponent logos and dates
- [x] PlayerDetailPanel: O/U line with dashed reference and over/under buttons
- [x] PlayerDetailPanel: alt threshold buttons (1+, 2+, 3+, 4+, 5+, 6+, 7+, 8+)
- [x] PlayerDetailPanel: stat category switcher (Hits/HR/TB/RBI/SB for batters; K/HA/ER/Outs for pitchers)
- [x] Same Game Parlay tabs on game view (Batting / Pitching / Specials)
- [x] Wire player row tap in PlayerPropsTab to open PlayerDetailPanel

## Round 6 — Parlays Tab

- [x] Create global BetSlipContext with legs, addLeg, removeLeg, clearLegs, combined odds
- [x] Wire PlayerPropsTab odds buttons to add legs to BetSlipContext
- [x] Wire PlayerDetailPanel O/U + alt threshold buttons to add legs to BetSlipContext
- [x] Build ParlaysTab: leg list with remove button, combined odds, payout calculator, FanDuel deep-link
- [x] Show floating parlay badge count on Parlays tab when legs are pending

## Round 7 — FanDuel SGP Layout Rebuild

- [x] Rebuild PlayerPropsTab: game selector header (team logos + date + time)
- [x] Collapsible market sections with SGP badge (Player Hits, Player Home Runs, Total Strikeouts O/U, 1st Inning O/U)
- [x] Real MLB headshots + player name + Last 5 AVG in each row
- [x] Threshold columns (1+, 2+, 3+, 4+) with blue outlined odds buttons matching FanDuel style
- [x] Sticky betslip bar at bottom: leg count badge + "$10 N-leg parlay wins $X.XX" + expand chevron
