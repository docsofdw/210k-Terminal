# Derivatives Strategy Simulator - Implementation Guide

Reference implementation from: `github.com/namcios/derivatives-simulator`

A web dashboard to simulate multi-leg options strategies on Bitcoin proxies (IBIT, MSTR) with BTC equivalent calculations.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [API Reference](#api-reference)
6. [Core Algorithms](#core-algorithms)
7. [Data Types](#data-types)
8. [Environment Setup](#environment-setup)
9. [Integration into 210k Terminal](#integration-into-210k-terminal)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ PriceDisplay │  │ OptionsChain │  │   StrategyBuilder    │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│  ┌──────────────┐  ┌──────────────────────────────────────────┐ │
│  │AnalysisPanel │  │           SavedStrategies                │ │
│  └──────────────┘  └──────────────────────────────────────────┘ │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTP/REST
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Backend (FastAPI)                          │
│  ┌─────────────────┐      ┌─────────────────────────────────┐   │
│  │  Routes         │      │  Services                       │   │
│  │  ├─ /api/quote  │      │  ├─ marketdata.py (API calls)   │   │
│  │  └─ /api/options│      │  ├─ analyzer.py (P&L calc)      │   │
│  └─────────────────┘      │  ├─ black_scholes.py (pricing)  │   │
│                           │  └─ cache.py (TTL cache)        │   │
│                           └─────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
       MarketData.app     CoinMarketCap      CoinGecko
       (Stocks/Options)      (BTC)           (BTC alt)
```

---

## Tech Stack

### Backend
| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | FastAPI | Async Python web framework |
| HTTP Client | httpx | Async HTTP requests |
| Math/Analysis | scipy, numpy | Black-Scholes, root finding |
| Caching | cachetools | TTL cache for API responses |
| Server | uvicorn | ASGI server |

### Frontend
| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | React 18 | UI library |
| Language | TypeScript | Type safety |
| Build | Vite | Fast dev/build |
| Styling | TailwindCSS | Utility-first CSS |

---

## Backend Implementation

### Project Structure

```
backend/
├── main.py                    # FastAPI app entry point
├── requirements.txt           # Python dependencies
├── .env.example              # Environment template
├── routes/
│   ├── __init__.py
│   ├── quotes.py             # Stock/BTC price endpoints
│   └── options.py            # Options chain & analysis
└── services/
    ├── __init__.py
    ├── marketdata.py         # MarketData.app API wrapper
    ├── analyzer.py           # Strategy analysis engine
    ├── black_scholes.py      # Options pricing model
    └── cache.py              # In-memory TTL cache
```

### main.py - Application Entry Point

```python
"""FastAPI main application for Derivatives Strategy Simulator."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

from routes import quotes, options

app = FastAPI(
    title="Derivatives Strategy Simulator",
    description="API for simulating options strategies on Bitcoin ETFs",
    version="1.0.0",
)

# CORS configuration
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "").split(",") if os.getenv("ALLOWED_ORIGINS") else []
DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS + DEFAULT_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(quotes.router)
app.include_router(options.router)

@app.get("/")
async def root():
    return {"status": "ok", "service": "Derivatives Strategy Simulator"}

@app.get("/api/health")
async def health_check():
    api_key = os.getenv("MARKETDATA_API_KEY")
    return {"status": "ok", "api_key_configured": bool(api_key)}
```

### services/marketdata.py - API Wrapper

```python
"""MarketData.app API wrapper for options and quote data."""

import os
import httpx
from typing import Optional
from datetime import datetime
from . import cache

MARKETDATA_BASE_URL = "https://api.marketdata.app/v1"

def _get_api_key() -> str:
    key = os.getenv("MARKETDATA_API_KEY")
    if not key:
        raise ValueError("MARKETDATA_API_KEY environment variable not set")
    return key

def _make_request(endpoint: str, params: Optional[dict] = None) -> dict:
    """Make authenticated request to MarketData.app API."""
    headers = {
        "Authorization": f"Token {_get_api_key()}",
        "Accept": "application/json",
    }
    url = f"{MARKETDATA_BASE_URL}{endpoint}"

    with httpx.Client(timeout=30.0) as client:
        response = client.get(url, headers=headers, params=params)
        response.raise_for_status()
        return response.json()

def get_quote(symbol: str) -> dict:
    """Get current quote for a symbol."""
    cached = cache.get("quote", symbol)
    if cached:
        return cached

    data = _make_request(f"/stocks/quotes/{symbol}/")

    result = {
        "symbol": symbol,
        "price": data.get("last", [None])[0],
        "bid": data.get("bid", [None])[0],
        "ask": data.get("ask", [None])[0],
        "change": data.get("change", [None])[0],
        "changePercent": data.get("changepct", [None])[0],
        "volume": data.get("volume", [None])[0],
        "timestamp": datetime.now().isoformat(),
    }

    cache.set(result, "quote", symbol)
    return result

def get_options_expirations(symbol: str) -> list[str]:
    """Get available expiration dates for a symbol's options."""
    cached = cache.get("expirations", symbol)
    if cached:
        return cached

    data = _make_request(f"/options/expirations/{symbol}/")
    expirations = data.get("expirations", [])

    cache.set(expirations, "expirations", symbol)
    return expirations

def get_options_chain(
    symbol: str,
    expiration: str,
    strike_price: Optional[float] = None,
    option_type: Optional[str] = None,
) -> list[dict]:
    """Get options chain for a symbol and expiration."""
    cache_key = (symbol, expiration, strike_price, option_type)
    cached = cache.get("chain", *cache_key)
    if cached:
        return cached

    params = {"expiration": expiration}
    if strike_price:
        params["strike"] = strike_price
    if option_type:
        params["side"] = option_type

    data = _make_request(f"/options/chain/{symbol}/", params=params)

    # Parse arrays into objects
    options = []
    option_symbols = data.get("optionSymbol", [])
    strikes = data.get("strike", [])
    sides = data.get("side", [])
    bids = data.get("bid", [])
    asks = data.get("ask", [])
    lasts = data.get("last", [])
    volumes = data.get("volume", [])
    open_interests = data.get("openInterest", [])
    ivs = data.get("iv", [])
    deltas = data.get("delta", [])
    gammas = data.get("gamma", [])
    thetas = data.get("theta", [])
    vegas = data.get("vega", [])

    for i in range(len(option_symbols)):
        options.append({
            "optionSymbol": option_symbols[i] if i < len(option_symbols) else None,
            "underlying": symbol,
            "expiration": expiration,
            "strike": strikes[i] if i < len(strikes) else None,
            "type": sides[i] if i < len(sides) else None,
            "bid": bids[i] if i < len(bids) else None,
            "ask": asks[i] if i < len(asks) else None,
            "last": lasts[i] if i < len(lasts) else None,
            "volume": volumes[i] if i < len(volumes) else None,
            "openInterest": open_interests[i] if i < len(open_interests) else None,
            "iv": ivs[i] if i < len(ivs) else None,
            "delta": deltas[i] if i < len(deltas) else None,
            "gamma": gammas[i] if i < len(gammas) else None,
            "theta": thetas[i] if i < len(thetas) else None,
            "vega": vegas[i] if i < len(vegas) else None,
        })

    cache.set(options, "chain", *cache_key)
    return options

def get_btc_price() -> dict:
    """Get current BTC price from CoinMarketCap API."""
    cached = cache.get("btc_price")
    if cached:
        return cached

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(
                "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest",
                params={"symbol": "BTC"},
                headers={"X-CMC_PRO_API_KEY": os.getenv("CMC_API_KEY")},
            )
            resp.raise_for_status()
            data = resp.json()

            btc_data = data.get("data", {}).get("BTC", {})
            quote = btc_data.get("quote", {}).get("USD", {})

            result = {
                "symbol": "BTC",
                "price": round(float(quote.get("price", 0)), 2),
                "changePercent": round(float(quote.get("percent_change_24h", 0)) / 100, 4),
                "timestamp": datetime.now().isoformat(),
            }

            cache.set(result, "btc_price")
            return result
    except Exception as e:
        raise Exception(f"Failed to fetch BTC price: {str(e)}")
```

### services/cache.py - TTL Cache

```python
"""In-memory cache for API responses to minimize API usage."""

from cachetools import TTLCache
from typing import Any, Optional
import hashlib
import json

# Cache with 5-minute TTL, max 1000 items
_cache: TTLCache = TTLCache(maxsize=1000, ttl=300)

def _make_key(prefix: str, *args, **kwargs) -> str:
    """Create a unique cache key from arguments."""
    key_data = json.dumps({"prefix": prefix, "args": args, "kwargs": kwargs}, sort_keys=True)
    return hashlib.md5(key_data.encode()).hexdigest()

def get(prefix: str, *args, **kwargs) -> Optional[Any]:
    """Get a value from cache."""
    key = _make_key(prefix, *args, **kwargs)
    return _cache.get(key)

def set(value: Any, prefix: str, *args, **kwargs) -> None:
    """Set a value in cache."""
    key = _make_key(prefix, *args, **kwargs)
    _cache[key] = value

def clear() -> None:
    """Clear all cached values."""
    _cache.clear()
```

### services/black_scholes.py - Options Pricing

```python
"""Black-Scholes options pricing model for what-if scenarios."""

import math
from scipy.stats import norm
from typing import Literal

def calculate_d1_d2(
    spot: float,
    strike: float,
    time_to_expiry: float,
    risk_free_rate: float,
    volatility: float,
) -> tuple[float, float]:
    """Calculate d1 and d2 for Black-Scholes formula."""
    if time_to_expiry <= 0 or volatility <= 0:
        return 0.0, 0.0

    sqrt_t = math.sqrt(time_to_expiry)
    d1 = (math.log(spot / strike) + (risk_free_rate + 0.5 * volatility**2) * time_to_expiry) / (
        volatility * sqrt_t
    )
    d2 = d1 - volatility * sqrt_t
    return d1, d2

def price_option(
    spot: float,
    strike: float,
    time_to_expiry: float,
    risk_free_rate: float,
    volatility: float,
    option_type: Literal["call", "put"],
) -> float:
    """
    Calculate theoretical option price using Black-Scholes model.

    Args:
        spot: Current price of the underlying
        strike: Strike price of the option
        time_to_expiry: Time to expiration in years (e.g., 30 days = 30/365)
        risk_free_rate: Annual risk-free interest rate (e.g., 0.045 for 4.5%)
        volatility: Annualized implied volatility (e.g., 0.30 for 30%)
        option_type: "call" or "put"

    Returns:
        Theoretical option price
    """
    if time_to_expiry <= 0:
        # At expiration, return intrinsic value
        if option_type == "call":
            return max(0, spot - strike)
        else:
            return max(0, strike - spot)

    d1, d2 = calculate_d1_d2(spot, strike, time_to_expiry, risk_free_rate, volatility)

    if option_type == "call":
        price = spot * norm.cdf(d1) - strike * math.exp(-risk_free_rate * time_to_expiry) * norm.cdf(d2)
    else:
        price = strike * math.exp(-risk_free_rate * time_to_expiry) * norm.cdf(-d2) - spot * norm.cdf(-d1)

    return max(0, price)

def calculate_greeks(
    spot: float,
    strike: float,
    time_to_expiry: float,
    risk_free_rate: float,
    volatility: float,
    option_type: Literal["call", "put"],
) -> dict:
    """Calculate option Greeks: delta, gamma, theta, vega, rho."""
    if time_to_expiry <= 0 or volatility <= 0:
        if option_type == "call":
            delta = 1.0 if spot > strike else 0.0
        else:
            delta = -1.0 if spot < strike else 0.0
        return {"delta": delta, "gamma": 0.0, "theta": 0.0, "vega": 0.0, "rho": 0.0}

    d1, d2 = calculate_d1_d2(spot, strike, time_to_expiry, risk_free_rate, volatility)
    sqrt_t = math.sqrt(time_to_expiry)
    exp_rt = math.exp(-risk_free_rate * time_to_expiry)

    gamma = norm.pdf(d1) / (spot * volatility * sqrt_t)
    vega = spot * sqrt_t * norm.pdf(d1) / 100

    if option_type == "call":
        delta = norm.cdf(d1)
        theta = (-spot * norm.pdf(d1) * volatility / (2 * sqrt_t)
                 - risk_free_rate * strike * exp_rt * norm.cdf(d2)) / 365
        rho = strike * time_to_expiry * exp_rt * norm.cdf(d2) / 100
    else:
        delta = norm.cdf(d1) - 1
        theta = (-spot * norm.pdf(d1) * volatility / (2 * sqrt_t)
                 + risk_free_rate * strike * exp_rt * norm.cdf(-d2)) / 365
        rho = -strike * time_to_expiry * exp_rt * norm.cdf(-d2) / 100

    return {"delta": delta, "gamma": gamma, "theta": theta, "vega": vega, "rho": rho}

def calculate_option_pnl(
    entry_premium: float,
    current_premium: float,
    quantity: int,
    action: Literal["buy", "sell"],
    contract_multiplier: int = 100,
) -> float:
    """Calculate P&L for an option position."""
    if action == "buy":
        return (current_premium - entry_premium) * quantity * contract_multiplier
    else:
        return (entry_premium - current_premium) * quantity * contract_multiplier
```

### services/analyzer.py - Strategy Analysis Engine

```python
"""Strategy analysis engine for calculating breakevens, max P/L, and current P&L."""

from typing import Literal, Optional
from dataclasses import dataclass
from scipy.optimize import brentq
import numpy as np
from . import black_scholes as bs

@dataclass
class OptionLeg:
    """Represents a single option leg in a strategy."""
    underlying: str
    option_type: Literal["call", "put"]
    action: Literal["buy", "sell"]
    strike: float
    expiration: str
    quantity: int
    premium: float
    iv: Optional[float] = None

@dataclass
class StrategyAnalysis:
    """Results of strategy analysis."""
    total_cost: float
    breakevens: list[float]
    max_profit: float | str
    max_loss: float | str
    current_pnl: float
    target_pnls: list[dict]

def calculate_leg_pnl_at_expiry(
    leg: OptionLeg,
    underlying_price: float,
    contract_multiplier: int = 100,
) -> float:
    """Calculate P&L for a single leg at expiration."""
    if leg.option_type == "call":
        intrinsic = max(0, underlying_price - leg.strike)
    else:
        intrinsic = max(0, leg.strike - underlying_price)

    cost = leg.premium * leg.quantity * contract_multiplier

    if leg.action == "buy":
        pnl = (intrinsic * leg.quantity * contract_multiplier) - cost
    else:
        pnl = cost - (intrinsic * leg.quantity * contract_multiplier)

    return pnl

def calculate_strategy_pnl_at_expiry(
    legs: list[OptionLeg],
    underlying_price: float,
    contract_multiplier: int = 100,
) -> float:
    """Calculate total strategy P&L at expiration."""
    return sum(calculate_leg_pnl_at_expiry(leg, underlying_price, contract_multiplier) for leg in legs)

def calculate_leg_pnl_with_time_value(
    leg: OptionLeg,
    underlying_price: float,
    time_to_expiry: float,
    risk_free_rate: float,
    contract_multiplier: int = 100,
) -> float:
    """Calculate P&L for a single leg with time value (Black-Scholes)."""
    if leg.iv is None or leg.iv <= 0:
        return calculate_leg_pnl_at_expiry(leg, underlying_price, contract_multiplier)

    theoretical_premium = bs.price_option(
        spot=underlying_price,
        strike=leg.strike,
        time_to_expiry=time_to_expiry,
        risk_free_rate=risk_free_rate,
        volatility=leg.iv,
        option_type=leg.option_type,
    )

    return bs.calculate_option_pnl(
        entry_premium=leg.premium,
        current_premium=theoretical_premium,
        quantity=leg.quantity,
        action=leg.action,
        contract_multiplier=contract_multiplier,
    )

def find_breakevens(
    legs: list[OptionLeg],
    current_price: float,
    contract_multiplier: int = 100,
    search_range_pct: float = 0.5,
) -> list[float]:
    """Find breakeven prices at expiration using numerical root finding."""
    if not legs:
        return []

    min_price = current_price * (1 - search_range_pct)
    max_price = current_price * (1 + search_range_pct)

    all_strikes = [leg.strike for leg in legs]
    min_price = min(min_price, min(all_strikes) * 0.8)
    max_price = max(max_price, max(all_strikes) * 1.2)

    num_points = 1000
    prices = np.linspace(min_price, max_price, num_points)
    pnls = [calculate_strategy_pnl_at_expiry(legs, p, contract_multiplier) for p in prices]

    breakevens = []
    for i in range(len(pnls) - 1):
        if pnls[i] * pnls[i + 1] < 0:
            try:
                be = brentq(
                    lambda p: calculate_strategy_pnl_at_expiry(legs, p, contract_multiplier),
                    prices[i],
                    prices[i + 1],
                )
                breakevens.append(round(be, 2))
            except ValueError:
                pass

    return sorted(set(breakevens))

def find_max_profit_loss(
    legs: list[OptionLeg],
    current_price: float,
    contract_multiplier: int = 100,
) -> tuple[float | str, float | str]:
    """Find maximum profit and loss at expiration."""
    if not legs:
        return 0, 0

    net_calls_sold = sum(leg.quantity for leg in legs if leg.option_type == "call" and leg.action == "sell")
    net_calls_bought = sum(leg.quantity for leg in legs if leg.option_type == "call" and leg.action == "buy")

    unlimited_loss_up = net_calls_sold > net_calls_bought
    unlimited_profit_up = net_calls_bought > net_calls_sold

    all_strikes = [leg.strike for leg in legs]
    min_price = 0.01
    max_price = max(all_strikes) * 2

    num_points = 2000
    prices = np.linspace(min_price, max_price, num_points)
    pnls = [calculate_strategy_pnl_at_expiry(legs, p, contract_multiplier) for p in prices]

    for strike in all_strikes:
        pnls.append(calculate_strategy_pnl_at_expiry(legs, strike, contract_multiplier))
        pnls.append(calculate_strategy_pnl_at_expiry(legs, strike - 0.01, contract_multiplier))
        pnls.append(calculate_strategy_pnl_at_expiry(legs, strike + 0.01, contract_multiplier))

    max_pnl = max(pnls)
    min_pnl = min(pnls)

    max_profit = "unlimited" if unlimited_profit_up else round(max_pnl, 2)
    max_loss = "unlimited" if unlimited_loss_up else round(abs(min_pnl), 2) if min_pnl < 0 else 0

    return max_profit, max_loss

def calculate_total_cost(legs: list[OptionLeg], contract_multiplier: int = 100) -> float:
    """Calculate total cost (debit) or credit of the strategy."""
    total = 0
    for leg in legs:
        leg_cost = leg.premium * leg.quantity * contract_multiplier
        if leg.action == "buy":
            total += leg_cost
        else:
            total -= leg_cost
    return round(total, 2)

def analyze_strategy(
    legs: list[OptionLeg],
    current_underlying_price: float,
    time_to_expiry: float,
    risk_free_rate: float = 0.045,
    target_prices: Optional[list[float]] = None,
    contract_multiplier: int = 100,
) -> StrategyAnalysis:
    """Perform complete analysis of an options strategy."""
    if not legs:
        return StrategyAnalysis(
            total_cost=0, breakevens=[], max_profit=0,
            max_loss=0, current_pnl=0, target_pnls=[],
        )

    total_cost = calculate_total_cost(legs, contract_multiplier)
    breakevens = find_breakevens(legs, current_underlying_price, contract_multiplier)
    max_profit, max_loss = find_max_profit_loss(legs, current_underlying_price, contract_multiplier)

    current_pnl = sum(
        calculate_leg_pnl_with_time_value(
            leg, current_underlying_price, time_to_expiry, risk_free_rate, contract_multiplier
        )
        for leg in legs
    )

    target_pnls = []
    if target_prices:
        for price in target_prices:
            pnl = sum(
                calculate_leg_pnl_with_time_value(
                    leg, price, time_to_expiry, risk_free_rate, contract_multiplier
                )
                for leg in legs
            )
            target_pnls.append({"price": price, "pnl": round(pnl, 2)})

    return StrategyAnalysis(
        total_cost=total_cost,
        breakevens=breakevens,
        max_profit=max_profit,
        max_loss=max_loss,
        current_pnl=round(current_pnl, 2),
        target_pnls=target_pnls,
    )
```

### routes/options.py - Options Endpoints

```python
"""Options chain and analysis endpoints."""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime, date
from services import marketdata
from services.analyzer import OptionLeg, analyze_strategy

router = APIRouter(prefix="/api/options", tags=["options"])

class OptionLegRequest(BaseModel):
    underlying: str
    option_type: Literal["call", "put"]
    action: Literal["buy", "sell"]
    strike: float
    expiration: str
    quantity: int
    premium: float
    iv: Optional[float] = None

class AnalyzeRequest(BaseModel):
    legs: list[OptionLegRequest]
    underlying_price: float
    risk_free_rate: float = 0.045
    target_prices: Optional[list[float]] = None
    target_date: Optional[str] = None

@router.get("/expirations/{symbol}")
async def get_expirations(symbol: str):
    """Get available expiration dates for a symbol's options."""
    symbol = symbol.upper()
    try:
        expirations = marketdata.get_options_expirations(symbol)
        return {"symbol": symbol, "expirations": expirations}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/chain/{symbol}")
async def get_options_chain(
    symbol: str,
    expiration: str = Query(..., description="Expiration date YYYY-MM-DD"),
    strike: Optional[float] = Query(None),
    option_type: Optional[Literal["call", "put"]] = Query(None),
):
    """Get options chain for a symbol and expiration."""
    symbol = symbol.upper()
    try:
        chain = marketdata.get_options_chain(
            symbol=symbol,
            expiration=expiration,
            strike_price=strike,
            option_type=option_type,
        )
        calls = [opt for opt in chain if opt.get("type") == "call"]
        puts = [opt for opt in chain if opt.get("type") == "put"]
        return {
            "symbol": symbol,
            "expiration": expiration,
            "calls": sorted(calls, key=lambda x: x.get("strike", 0)),
            "puts": sorted(puts, key=lambda x: x.get("strike", 0)),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze")
async def analyze_options_strategy(request: AnalyzeRequest):
    """Analyze an options strategy."""
    if not request.legs:
        raise HTTPException(status_code=400, detail="At least one leg required")

    legs = [
        OptionLeg(
            underlying=leg.underlying,
            option_type=leg.option_type,
            action=leg.action,
            strike=leg.strike,
            expiration=leg.expiration,
            quantity=leg.quantity,
            premium=leg.premium,
            iv=leg.iv,
        )
        for leg in request.legs
    ]

    expirations = [datetime.strptime(leg.expiration, "%Y-%m-%d").date() for leg in legs]
    earliest_expiry = min(expirations)
    eval_date = datetime.strptime(request.target_date, "%Y-%m-%d").date() if request.target_date else date.today()
    days_to_expiry = (earliest_expiry - eval_date).days
    time_to_expiry = max(0, days_to_expiry) / 365.0

    try:
        analysis = analyze_strategy(
            legs=legs,
            current_underlying_price=request.underlying_price,
            time_to_expiry=time_to_expiry,
            risk_free_rate=request.risk_free_rate,
            target_prices=request.target_prices,
        )
        return {
            "total_cost": analysis.total_cost,
            "breakevens": analysis.breakevens,
            "max_profit": analysis.max_profit,
            "max_loss": analysis.max_loss,
            "current_pnl": analysis.current_pnl,
            "target_pnls": analysis.target_pnls,
            "days_to_expiry": days_to_expiry,
            "time_to_expiry_years": round(time_to_expiry, 4),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### requirements.txt

```
fastapi>=0.109.0
uvicorn>=0.27.0
httpx>=0.26.0
python-dotenv>=1.0.0
pydantic>=2.6.0
scipy>=1.11.0
numpy>=1.26.0
cachetools>=5.3.0
```

---

## Frontend Implementation

### Project Structure

```
frontend/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── types/
    │   └── index.ts
    ├── services/
    │   ├── api.ts
    │   └── storage.ts
    ├── hooks/
    │   ├── useOptions.ts
    │   └── useQuotes.ts
    ├── utils/
    │   └── btcConversion.ts
    └── components/
        ├── PriceDisplay.tsx
        ├── OptionsChain.tsx
        ├── StrategyBuilder.tsx
        ├── AnalysisPanel.tsx
        └── SavedStrategies.tsx
```

### types/index.ts - TypeScript Definitions

```typescript
export type Underlying =
  | 'IBIT' | 'MSTR' | 'BITF' | 'BITO' | 'BTBT' | 'CIFR'
  | 'CLSK' | 'COIN' | 'CORZ' | 'FBTC' | 'GBTC' | 'HIVE'
  | 'HOOD' | 'HUT' | 'IREN' | 'MARA' | 'RIOT';

export type OptionType = 'call' | 'put';
export type Action = 'buy' | 'sell';

export interface Quote {
  symbol: string;
  price: number | null;
  bid: number | null;
  ask: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  timestamp: string;
  error?: string;
}

export interface OptionContract {
  optionSymbol: string;
  underlying: string;
  expiration: string;
  strike: number;
  type: OptionType;
  bid: number | null;
  ask: number | null;
  last: number | null;
  volume: number | null;
  openInterest: number | null;
  iv: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
}

export interface OptionsChain {
  symbol: string;
  expiration: string;
  calls: OptionContract[];
  puts: OptionContract[];
}

export interface OptionLeg {
  id: string;
  underlying: Underlying;
  type: OptionType;
  action: Action;
  strike: number;
  expiration: string;
  quantity: number;
  premium: number;
  iv: number | null;
  optionSymbol?: string;
}

export interface Strategy {
  id: string;
  name: string;
  legs: OptionLeg[];
  createdAt: string;
  notes?: string;
}

export interface AnalyzeRequest {
  legs: {
    underlying: string;
    option_type: OptionType;
    action: Action;
    strike: number;
    expiration: string;
    quantity: number;
    premium: number;
    iv: number | null;
  }[];
  underlying_price: number;
  risk_free_rate: number;
  target_prices?: number[];
  target_date?: string;
}

export interface StrategyAnalysis {
  total_cost: number;
  breakevens: number[];
  max_profit: number | 'unlimited';
  max_loss: number | 'unlimited';
  current_pnl: number;
  target_pnls: { price: number; pnl: number }[];
  days_to_expiry: number;
  time_to_expiry_years: number;
}

export interface ExpirationsResponse {
  symbol: string;
  expirations: string[];
}
```

### services/api.ts - API Client

```typescript
import type {
  Quote,
  OptionsChain,
  AnalyzeRequest,
  StrategyAnalysis,
  ExpirationsResponse,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getQuote(symbol: string): Promise<Quote> {
  return fetchJson<Quote>(`${API_BASE}/quote/${symbol}`);
}

export async function getAllQuotes(): Promise<Record<string, Quote>> {
  return fetchJson<Record<string, Quote>>(`${API_BASE}/quote/`);
}

export async function getExpirations(symbol: string): Promise<ExpirationsResponse> {
  return fetchJson<ExpirationsResponse>(`${API_BASE}/options/expirations/${symbol}`);
}

export async function getOptionsChain(
  symbol: string,
  expiration: string,
): Promise<OptionsChain> {
  const params = new URLSearchParams({ expiration });
  return fetchJson<OptionsChain>(`${API_BASE}/options/chain/${symbol}?${params}`);
}

export async function analyzeStrategy(request: AnalyzeRequest): Promise<StrategyAnalysis> {
  return fetchJson<StrategyAnalysis>(`${API_BASE}/options/analyze`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
```

### utils/btcConversion.ts - BTC Equivalents

```typescript
/**
 * BTC conversion utilities for IBIT price display.
 * Uses dynamic ratio: IBIT_price / BTC_price
 */

export function getBtcPerIbit(ibitPrice: number, btcPrice: number): number {
  if (!btcPrice || btcPrice <= 0) return 0;
  return ibitPrice / btcPrice;
}

// "At what BTC price does IBIT hit this strike?"
export function ibitStrikeToBtcPrice(strike: number, ibitPrice: number, btcPrice: number): number {
  if (!ibitPrice || ibitPrice <= 0) return 0;
  const btcPerIbit = getBtcPerIbit(ibitPrice, btcPrice);
  if (btcPerIbit <= 0) return 0;
  return strike / btcPerIbit;
}

export function usdToBtc(usd: number, btcPrice: number): number {
  if (!btcPrice || btcPrice <= 0) return 0;
  return usd / btcPrice;
}

export function formatBtc(btc: number): string {
  if (btc === 0) return '0';
  const abs = Math.abs(btc);
  if (abs >= 1) return btc.toFixed(2);
  if (abs >= 0.01) return btc.toFixed(4);
  if (abs >= 0.0001) return btc.toFixed(6);
  return btc.toFixed(8);
}

export function formatBtcPrice(price: number): string {
  return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
```

### hooks/useOptions.ts

```typescript
import { useState, useCallback } from 'react';
import type { OptionsChain, ExpirationsResponse } from '../types';
import { getExpirations, getOptionsChain } from '../services/api';

export function useOptions() {
  const [expirations, setExpirations] = useState<string[]>([]);
  const [chain, setChain] = useState<OptionsChain | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExpirations = useCallback(async (symbol: string) => {
    setLoading(true);
    setError(null);
    try {
      const data: ExpirationsResponse = await getExpirations(symbol);
      setExpirations(data.expirations);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch expirations');
      setExpirations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchChain = useCallback(async (symbol: string, expiration: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOptionsChain(symbol, expiration);
      setChain(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch options chain');
      setChain(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { expirations, chain, loading, error, fetchExpirations, fetchChain };
}
```

### hooks/useQuotes.ts

```typescript
import { useState, useCallback } from 'react';
import type { Quote } from '../types';
import { getAllQuotes } from '../services/api';

export function useQuotes() {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllQuotes();
      setQuotes(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch quotes');
    } finally {
      setLoading(false);
    }
  }, []);

  return { quotes, loading, error, refresh };
}
```

---

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/quote/{symbol}` | GET | Get current price for IBIT, MSTR, or BTC |
| `GET /api/quote/` | GET | Get all quotes (IBIT, MSTR, BTC) |
| `GET /api/options/expirations/{symbol}` | GET | Get available expiration dates |
| `GET /api/options/chain/{symbol}?expiration=YYYY-MM-DD` | GET | Get options chain with Greeks |
| `POST /api/options/analyze` | POST | Analyze multi-leg strategy |

### POST /api/options/analyze Request

```json
{
  "legs": [
    {
      "underlying": "IBIT",
      "option_type": "call",
      "action": "buy",
      "strike": 60.0,
      "expiration": "2026-03-21",
      "quantity": 1,
      "premium": 3.50,
      "iv": 0.65
    }
  ],
  "underlying_price": 58.50,
  "risk_free_rate": 0.045,
  "target_prices": [55.0, 60.0, 65.0]
}
```

### Response

```json
{
  "total_cost": 350.00,
  "breakevens": [63.50],
  "max_profit": "unlimited",
  "max_loss": 350.00,
  "current_pnl": -25.50,
  "target_pnls": [
    {"price": 55.0, "pnl": -200.00},
    {"price": 60.0, "pnl": 50.00},
    {"price": 65.0, "pnl": 450.00}
  ],
  "days_to_expiry": 49,
  "time_to_expiry_years": 0.1342
}
```

---

## Core Algorithms

### Black-Scholes Formula

```
d1 = [ln(S/K) + (r + σ²/2)T] / (σ√T)
d2 = d1 - σ√T

Call Price = S·N(d1) - K·e^(-rT)·N(d2)
Put Price  = K·e^(-rT)·N(-d2) - S·N(-d1)

Where:
  S = Spot price
  K = Strike price
  r = Risk-free rate
  σ = Implied volatility
  T = Time to expiry (years)
  N() = Cumulative normal distribution
```

### Breakeven Calculation

Uses Brent's method (scipy.optimize.brentq) to find roots:
1. Sample P&L across price range
2. Find intervals where sign changes
3. Use root-finding to get precise breakeven

### BTC Equivalent Conversion

```
BTC per IBIT = IBIT_price / BTC_price

Strike → BTC Level = Strike / (BTC per IBIT)
                   = Strike × BTC_price / IBIT_price
```

---

## Environment Setup

### Backend (.env)

```bash
MARKETDATA_API_KEY=your_marketdata_api_key
CMC_API_KEY=your_coinmarketcap_api_key
ALLOWED_ORIGINS=https://yourdomain.com
```

### Frontend (.env)

```bash
VITE_API_URL=https://api.yourdomain.com
```

### Data Sources

| Provider | Purpose | Free Tier |
|----------|---------|-----------|
| MarketData.app | Stock quotes, options chains | 100 req/day |
| CoinMarketCap | BTC price | 10,000 req/month |

---

## Integration into 210k Terminal

### Option A: Standalone Python Backend

Add a separate Python service:
```
/derivatives-api/
├── main.py
├── requirements.txt
├── routes/
└── services/
```

Deploy on Vercel/Railway/Render with `uvicorn main:app`

### Option B: Next.js API Routes

Port the Python logic to TypeScript:
- `/app/api/options/expirations/[symbol]/route.ts`
- `/app/api/options/chain/[symbol]/route.ts`
- `/app/api/options/analyze/route.ts`

Use `mathjs` or implement Black-Scholes in TS.

### Option C: Hybrid

- Keep Python backend for complex math (Black-Scholes, scipy)
- Frontend integrated into existing Next.js app
- Call Python API from Next.js server actions

### Recommended Approach

**Option C (Hybrid)** is recommended because:
1. Black-Scholes and scipy work better in Python
2. Frontend components can reuse existing Shadcn/Tailwind setup
3. Server actions can proxy to Python backend
4. Caching can use existing Redis/in-memory setup

### Frontend Components to Build

1. **OptionsChainSelector** - Symbol + expiration dropdowns
2. **OptionsChainTable** - Calls/puts with Greeks
3. **StrategyBuilder** - Multi-leg builder with BTC equivalents
4. **AnalysisPanel** - P&L, breakevens, what-if scenarios
5. **SavedStrategies** - Local storage persistence

### Database Considerations

No database needed - all data is:
- Real-time from APIs
- User strategies in localStorage
- Could add Supabase table for saved strategies if needed

---

## Quick Start Commands

### Backend

```bash
cd derivatives-api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with API keys
uvicorn main:app --host 127.0.0.1 --port 8000
```

### Frontend (if separate)

```bash
cd derivatives-frontend
npm install
npm run dev
```

Open http://localhost:5173

---

## Next Steps for Implementation

1. [ ] Decide on integration approach (A, B, or C)
2. [ ] Get MarketData.app API key (free tier)
3. [ ] Get CoinMarketCap API key (free tier)
4. [ ] Set up Python backend service
5. [ ] Build frontend components using existing Shadcn setup
6. [ ] Add BTC equivalent conversions for treasury companies
7. [ ] Test with IBIT and MSTR options
8. [ ] Deploy backend service
9. [ ] Add to 210k Terminal navigation
