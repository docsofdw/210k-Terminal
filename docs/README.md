# Documentation

Organized by site sections matching the app navigation.

## Structure

```
docs/
├── markets/          # /dashboard/comps, /dashboard/derivatives (simulator)
│   ├── COMPS_TABLE.md
│   ├── COMPANIES.md
│   └── DERIVATIVES_SIMULATOR.md
│
├── portfolio/        # /dashboard/portfolio, /dashboard/derivatives-positions
│   ├── PORTFOLIO_POSITIONS.md
│   └── DERIVATIVES.md
│
├── analytics/        # /dashboard/charts, /dashboard/fund-performance, /dashboard/on-chain
│   ├── FUND_PERFORMANCE.md
│   └── ON_CHAIN_METRICS.md
│
├── alerts/           # /dashboard/alerts
│   ├── ALERTS.md
│   └── TELEGRAM_ALERTS.md
│
├── meta/             # Project-wide documentation
│   ├── PROJECT.md
│   ├── FEATURES.md
│   ├── DATA_MODEL.md
│   ├── API_INTEGRATIONS.md
│   ├── CALCULATIONS.md
│   └── HISTORICAL_DATA.md
│
└── build_process/    # Build logs and migration notes
    ├── BUILD_LOG_*.md
    ├── DATA_QUALITY_ISSUES.md
    ├── MARKET_DATA_API_MIGRATION.md
    └── NEXT_STEPS.md
```

## Quick Links

| Section | Key Docs |
|---------|----------|
| Markets | [Comps Table](markets/COMPS_TABLE.md), [Derivatives Simulator](markets/DERIVATIVES_SIMULATOR.md) |
| Portfolio | [Positions](portfolio/PORTFOLIO_POSITIONS.md), [Clear Street Derivatives](portfolio/DERIVATIVES.md) |
| Analytics | [Fund Performance](analytics/FUND_PERFORMANCE.md), [On-Chain Metrics](analytics/ON_CHAIN_METRICS.md) |
| Alerts | [Alert System](alerts/ALERTS.md), [Telegram](alerts/TELEGRAM_ALERTS.md) |
| Meta | [Project Overview](meta/PROJECT.md), [Data Model](meta/DATA_MODEL.md), [APIs](meta/API_INTEGRATIONS.md) |
