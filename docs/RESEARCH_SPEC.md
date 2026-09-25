# BetLab — Research Specification v0.1

## Mission
Construire un laboratoire de stratégies de paris sportifs mesurables, falsifiables et reproductibles. Le système ne promet aucun gain. Il privilégie l'identification d'inefficiences conditionnelles plutôt que les pronostics génériques.

## Pipeline
IDEA → LAB → BACKTEST → VALIDATED LAB → SHADOW → CANARY → PRODUCTION → REVIEW/KILL.

## Règles fondamentales
1. Zéro leakage temporel : une décision à T n'utilise que Data(t≤T).
2. TRAIN → VALIDATION → TEST invisible → walk-forward.
3. Flat 10 € avant toute optimisation de staking.
4. ROI seul ne valide jamais une stratégie.
5. Mesures obligatoires : N, win rate, cote moyenne, profit, ROI, CI, max drawdown, losing streak, Brier, log-loss, ECE, CLV si disponible.
6. Longshot Dependency Ratio et Profit Concentration Top-10 obligatoires.
7. Tous les essais sont enregistrés afin de mesurer le data-mining; DSR/PBO et FDR sont prévus en phase avancée.
8. Les stratégies proches sont regroupées par famille; plusieurs variantes corrélées ne comptent pas comme validations indépendantes.
9. Les signaux SHADOW sont append-only et horodatés avant événement.
10. La réglementation française est un filtre séparé, versionné et default-deny sans règle actuelle chargée.

## Familles de recherche
### Market microstructure
Weighted Consensus; Sharp vs Soft; Leader-Follower Lag; Information Half-Life; Consensus Catch-Up; Market Dispersion; Bookmaker Fingerprinting; Opening→Closing; Steam/Velocity/Acceleration; Overshoot/Snapback.

### Cross-market
Asian Handicap Oracle; AH–1X2 Gap; Total–Team Total Gap; Goal–Scorer Gap; Player/Team probability conservation; Cross-Market Confirmation.

### Fundamental / regression
Poisson; Dixon-Coles; Skellam; xG; xG Regression; Result Illusion; Schedule Illusion; Opponent Inflation; Anchoring Decay.

### Tennis
Elo; Surface Elo; Market + Surface Elo; transition surface; qualifier load; serve-environment shift.

### Player props
Role Shock; Minutes Shock; Penalty Succession; Usage Redistribution; Replacement Graph; Formation-to-Prop Shift; NHL line/PP promotion; NBA backup cascade.

### Live
Pressure Acceleration; Quality Pressure; Score Liar; Goal Surprise; Favourite Concede; Red Card Context; Substitution Shock; Late Fatigue; Market Freeze; Cross-Market Live.

### Risk/meta filters
False Value Detector; Agreement-Adjusted Edge; model isolation penalty; data freshness; shrinkage to market; robust EV; Error Regime Detector; model drift; latent scenario exposure.

## Robust EV
p* = w × p_model + (1−w) × p_market.  
p_conservative = p* − uncertainty adjustment.  
EV_robust = p_conservative × odds − 1.

Le poids w dépend de la fiabilité OOS historique et n'est jamais choisi après inspection du TEST.

## Snapshot requirement
Les méthodes Bookmaker Lag / Steam / Information Half-Life / Live ne sont pas backtestables honnêtement avec seulement opening et closing. Il faut une série horodatée : event_id, bookmaker, market, selection, line, odds, observed_at.

## Shadow ledger
Chaque prédiction stocke : created_at, event_start, strategy/model version, odds timestamp, bookmaker, market, selection, p_market, p_model, p_shrunk, EV brut/robuste, décision. Une révision crée une nouvelle ligne; l'ancienne n'est jamais modifiée.

## Kill engine
Suspendre si : CLV devient durablement négatif, calibration dérive, disponibilité réelle s'effondre, edge disparaît avec latence raisonnable, distribution des features quitte le domaine d'entraînement, feed devient douteux, ou la stratégie dépend de quelques longshots.

## Scope v0.1 livré
- SQLite local sans dépendance npm (Node 22 `node:sqlite`).
- Dashboard mobile.
- Registre seedé de stratégies prioritaires.
- API append-only snapshots/signaux.
- De-vig multiplicatif + Power.
- Robust EV/shrinkage.
- Backtest Football-Data Favorite–Longshot par buckets.
- ROI, bootstrap CI, drawdown, losing streak, Brier, log-loss, ECE, LDR, PCR10.
- Default-deny réglementaire tant que des règles actuelles ne sont pas chargées.

## Prochaines implémentations
1. Adaptateur odds provider normalisé.
2. Scheduler de snapshots.
3. Weighted consensus multi-books.
4. Leader/follower cross-correlation et lag matrix.
5. AH↔1X2 derivation.
6. Research trials + walk-forward runner.
7. PBO/DSR/FDR.
8. Supabase/Postgres adapter pour hébergement persistant.
9. Imports ANJ versionnés depuis source officielle.
10. Connecteurs player/live selon disponibilité légale et qualité de données.
