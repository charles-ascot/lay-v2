"""
CHIMERA Lay Betting Backend
FastAPI application for Betfair Exchange integration
Project: chimera-v4
UPDATED: Added account balance endpoint
"""

import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager
from urllib.parse import urlencode

import httpx
from fastapi import FastAPI, HTTPException, Depends, Header, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import asyncio

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =============================================================================
# Configuration
# =============================================================================

class Config:
    """Application configuration from environment variables."""
    BETFAIR_APP_KEY: str = os.getenv("BETFAIR_APP_KEY", "JCZbQsjmX87BDsWa")
    BETFAIR_LOGIN_URL: str = "https://identitysso.betfair.com/api/login"
    BETFAIR_KEEPALIVE_URL: str = "https://identitysso.betfair.com/api/keepAlive"
    BETFAIR_LOGOUT_URL: str = "https://identitysso.betfair.com/api/logout"
    BETFAIR_API_URL: str = "https://api.betfair.com/exchange/betting/json-rpc/v1"
    BETFAIR_ACCOUNT_URL: str = "https://api.betfair.com/exchange/account/json-rpc/v1"
    
    # Rate limiting: max 5 requests per market per second
    RATE_LIMIT_REQUESTS: int = 5
    RATE_LIMIT_WINDOW: float = 1.0
    
    # Session timeout (12 hours for international exchange)
    SESSION_TIMEOUT_HOURS: int = 12

config = Config()

# =============================================================================
# Pydantic Models
# =============================================================================

class LoginRequest(BaseModel):
    """Login credentials for Betfair authentication."""
    username: str = Field(..., description="Betfair username")
    password: str = Field(..., description="Betfair password")

class LoginResponse(BaseModel):
    """Response from successful authentication."""
    session_token: str
    expires_at: str
    status: str = "SUCCESS"

class MarketFilter(BaseModel):
    """Filter parameters for market discovery."""
    event_type_ids: List[str] = Field(default=["7"], description="Sport IDs (7=Horse Racing)")
    market_type_codes: List[str] = Field(default=["WIN"], description="Market types")
    max_results: int = Field(default=100, ge=1, le=1000)
    from_time: Optional[str] = None
    to_time: Optional[str] = None

class MarketBookRequest(BaseModel):
    """Request parameters for market book retrieval."""
    market_ids: List[str] = Field(..., min_length=1, max_length=40)
    price_projection: List[str] = Field(default=["EX_BEST_OFFERS"])
    virtualise: bool = Field(default=True)

class PlaceOrderRequest(BaseModel):
    """Request to place a lay bet."""
    market_id: str
    selection_id: int
    odds: float = Field(..., gt=1.01, le=1000)
    stake: float = Field(..., gt=0)
    persistence_type: str = Field(default="LAPSE")

class ErrorResponse(BaseModel):
    """Standard error response."""
    error: str
    detail: Optional[str] = None
    code: Optional[str] = None

# =============================================================================
# Rate Limiter
# =============================================================================

class RateLimiter:
    """Simple rate limiter for Betfair API compliance."""
    
    def __init__(self, max_requests: int, window_seconds: float):
        self.max_requests = max_requests
        self.window = window_seconds
        self.requests: Dict[str, List[float]] = {}
        self._lock = asyncio.Lock()
    
    async def acquire(self, key: str) -> bool:
        """Attempt to acquire a rate limit slot."""
        async with self._lock:
            now = datetime.now(timezone.utc).timestamp()
            
            if key not in self.requests:
                self.requests[key] = []
            
            # Remove expired timestamps
            self.requests[key] = [
                ts for ts in self.requests[key] 
                if now - ts < self.window
            ]
            
            if len(self.requests[key]) >= self.max_requests:
                return False
            
            self.requests[key].append(now)
            return True
    
    async def wait_and_acquire(self, key: str, timeout: float = 5.0) -> bool:
        """Wait until rate limit slot is available."""
        start = datetime.now(timezone.utc).timestamp()
        while datetime.now(timezone.utc).timestamp() - start < timeout:
            if await self.acquire(key):
                return True
            await asyncio.sleep(0.1)
        return False

rate_limiter = RateLimiter(config.RATE_LIMIT_REQUESTS, config.RATE_LIMIT_WINDOW)

# =============================================================================
# Betfair Error Codes
# =============================================================================

BETFAIR_ERROR_MESSAGES = {
    "INVALID_USERNAME_OR_PASSWORD": "Invalid username or password",
    "ACCOUNT_NOW_LOCKED": "Account has been locked",
    "ACCOUNT_ALREADY_LOCKED": "Account is already locked",
    "PENDING_AUTH": "Pending authentication required",
    "TELBET_TERMS_CONDITIONS_NA": "Telbet terms not accepted",
    "DUPLICATE_CARDS": "Duplicate cards on account",
    "SECURITY_QUESTION_WRONG_3X": "Security question answered incorrectly 3 times",
    "KYC_SUSPEND": "Account suspended for KYC verification",
    "SUSPENDED": "Account is suspended",
    "CLOSED": "Account is closed",
    "SELF_EXCLUDED": "Account is self-excluded",
    "INVALID_CONNECTIVITY_TO_REGULATOR_DK": "Cannot connect to Danish regulator",
    "INVALID_CONNECTIVITY_TO_REGULATOR_IT": "Cannot connect to Italian regulator",
    "NOT_AUTHORIZED_BY_REGULATOR_DK": "Not authorized in Denmark",
    "NOT_AUTHORIZED_BY_REGULATOR_IT": "Not authorized in Italy",
    "SECURITY_RESTRICTED_LOCATION": "Access restricted from your location",
    "BETTING_RESTRICTED_LOCATION": "Betting restricted from your location",
    "TRADING_MASTER": "Trading Master account",
    "TRADING_MASTER_SUSPENDED": "Trading Master account suspended",
    "AGENT_CLIENT_MASTER": "Agent Client Master account",
    "AGENT_CLIENT_MASTER_SUSPENDED": "Agent Client Master suspended",
    "DANISH_AUTHORIZATION_REQUIRED": "Danish authorization required",
    "SPAIN_MIGRATION_REQUIRED": "Spain migration required",
    "DENMARK_MIGRATION_REQUIRED": "Denmark migration required",
    "SPANISH_TERMS_ACCEPTANCE_REQUIRED": "Spanish terms must be accepted",
    "ITALIAN_CONTRACT_ACCEPTANCE_REQUIRED": "Italian contract must be accepted",
    "CERT_AUTH_REQUIRED": "Certificate authentication required",
    "CHANGE_PASSWORD_REQUIRED": "Password change required",
    "PERSONAL_MESSAGE_REQUIRED": "Personal message required",
    "INTERNATIONAL_TERMS_ACCEPTANCE_REQUIRED": "International terms must be accepted",
    "EMAIL_LOGIN_NOT_ALLOWED": "Email login not enabled for this account",
    "MULTIPLE_USERS_WITH_SAME_CREDENTIAL": "Multiple users with same credentials",
    "ACCOUNT_PENDING_PASSWORD_CHANGE": "Password change required to reactivate",
    "TEMPORARY_BAN_TOO_MANY_REQUESTS": "Too many login attempts. Banned for 20 minutes",
    "ITALIAN_PROFILING_ACCEPTANCE_REQUIRED": "Italian profiling terms must be accepted",
    "AUTHORIZED_ONLY_FOR_DOMAIN_RO": "Account only authorized for .ro domain",
    "AUTHORIZED_ONLY_FOR_DOMAIN_SE": "Account only authorized for .se domain",
    "ACTIONS_REQUIRED": "Please login to betfair.com to complete required actions",
}

# =============================================================================
# Betfair API Client
# =============================================================================

class BetfairClient:
    """Async client for Betfair Exchange API."""
    
    def __init__(self):
        self.app_key = config.BETFAIR_APP_KEY
        self._client: Optional[httpx.AsyncClient] = None
    
    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=30.0,
                headers={"Accept-Encoding": "gzip"}
            )
        return self._client
    
    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None
    
    def _get_headers(self, session_token: Optional[str] = None) -> Dict[str, str]:
        """Build headers for Betfair API requests."""
        headers = {
            "X-Application": self.app_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Accept-Encoding": "gzip"
        }
        if session_token:
            headers["X-Authentication"] = session_token
        return headers
    
    async def login(self, username: str, password: str) -> Dict[str, Any]:
        """
        Authenticate with Betfair using interactive login.
        Returns session token on success.
        
        Per Betfair API docs:
        - Content-Type must be application/x-www-form-urlencoded
        - Body must be form-encoded, not JSON
        """
        try:
            # Form-encoded body per Betfair API spec
            body = urlencode({
                "username": username,
                "password": password
            })
            
            headers = {
                "Accept": "application/json",
                "X-Application": self.app_key,
                "Content-Type": "application/x-www-form-urlencoded"
            }
            
            logger.info(f"Attempting login for user: {username}")
            logger.info(f"Login URL: {config.BETFAIR_LOGIN_URL}")
            
            response = await self.client.post(
                config.BETFAIR_LOGIN_URL,
                content=body,
                headers=headers
            )
            
            logger.info(f"Login response status code: {response.status_code}")
            
            # Check for non-JSON response (blocked/error page)
            content_type = response.headers.get("content-type", "")
            if "application/json" not in content_type:
                logger.error(f"Non-JSON response: {content_type}")
                logger.error(f"Response body: {response.text[:500]}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Betfair returned non-JSON response. May be geo-blocked or service unavailable."
                )
            
            result = response.json()
            logger.info(f"Login response status: {result.get('status')}")
            
            if result.get("status") == "SUCCESS":
                return {
                    "session_token": result.get("token"),
                    "status": "SUCCESS",
                    "expires_at": (
                        datetime.now(timezone.utc) + 
                        timedelta(hours=config.SESSION_TIMEOUT_HOURS)
                    ).isoformat()
                }
            elif result.get("status") == "LIMITED_ACCESS":
                # Can login but restrictions apply
                return {
                    "session_token": result.get("token"),
                    "status": "LIMITED_ACCESS",
                    "expires_at": (
                        datetime.now(timezone.utc) + 
                        timedelta(hours=config.SESSION_TIMEOUT_HOURS)
                    ).isoformat(),
                    "warning": "Account has limited access"
                }
            else:
                error_code = result.get("error", "UNKNOWN_ERROR")
                error_message = BETFAIR_ERROR_MESSAGES.get(
                    error_code, 
                    f"Authentication failed: {error_code}"
                )
                logger.error(f"Login failed: {error_code} - {error_message}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=error_message
                )
                
        except httpx.RequestError as e:
            logger.error(f"Login request error: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Failed to connect to Betfair: {str(e)}"
            )
    
    async def keep_alive(self, session_token: str) -> Dict[str, Any]:
        """Extend session lifetime."""
        try:
            headers = {
                "Accept": "application/json",
                "X-Application": self.app_key,
                "X-Authentication": session_token
            }
            
            response = await self.client.get(
                config.BETFAIR_KEEPALIVE_URL,
                headers=headers
            )
            result = response.json()
            
            if result.get("status") == "SUCCESS":
                return {
                    "status": "SUCCESS",
                    "token": result.get("token"),
                    "expires_at": (
                        datetime.now(timezone.utc) + 
                        timedelta(hours=config.SESSION_TIMEOUT_HOURS)
                    ).isoformat()
                }
            else:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session expired or invalid"
                )
                
        except httpx.RequestError as e:
            logger.error(f"Keep alive error: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(e)
            )
    
    async def logout(self, session_token: str) -> Dict[str, Any]:
        """Terminate session."""
        try:
            headers = {
                "Accept": "application/json",
                "X-Application": self.app_key,
                "X-Authentication": session_token
            }
            
            response = await self.client.get(
                config.BETFAIR_LOGOUT_URL,
                headers=headers
            )
            return response.json()
        except httpx.RequestError as e:
            logger.error(f"Logout error: {e}")
            return {"status": "ERROR", "error": str(e)}
    
    async def _api_request(
        self, 
        method: str, 
        params: Dict[str, Any], 
        session_token: str,
        rate_limit_key: Optional[str] = None,
        endpoint_url: str = None
    ) -> Dict[str, Any]:
        """
        Make JSON-RPC request to Betfair API.
        """
        # Apply rate limiting if key provided
        if rate_limit_key:
            if not await rate_limiter.wait_and_acquire(rate_limit_key):
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded"
                )
        
        payload = {
            "jsonrpc": "2.0",
            "method": f"SportsAPING/v1.0/{method}",
            "params": params,
            "id": 1
        }
        
        url = endpoint_url or config.BETFAIR_API_URL
        
        try:
            response = await self.client.post(
                url,
                json=payload,
                headers=self._get_headers(session_token)
            )
            
            result = response.json()
            
            if "error" in result:
                error = result["error"]
                error_data = error.get("data", {})
                
                # Check for session expiry
                if error_data.get("exceptionname") == "INVALID_SESSION_INFORMATION":
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Session expired"
                    )
                
                logger.error(f"API error: {error}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=error.get("message", str(error))
                )
            
            return result.get("result", {})
            
        except httpx.RequestError as e:
            logger.error(f"API request error: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(e)
            )

    async def _account_request(
        self, 
        method: str, 
        params: Dict[str, Any], 
        session_token: str
    ) -> Dict[str, Any]:
        """Make JSON-RPC request to Betfair Account API."""
        payload = {
            "jsonrpc": "2.0",
            "method": f"AccountAPING/v1.0/{method}",
            "params": params,
            "id": 1
        }
        
        try:
            response = await self.client.post(
                config.BETFAIR_ACCOUNT_URL,
                json=payload,
                headers=self._get_headers(session_token)
            )
            
            result = response.json()
            
            if "error" in result:
                error = result["error"]
                logger.error(f"Account API error: {error}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=error.get("message", str(error))
                )
            
            return result.get("result", {})
            
        except httpx.RequestError as e:
            logger.error(f"Account API request error: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(e)
            )
    
    async def get_account_funds(self, session_token: str) -> Dict[str, Any]:
        """Get account balance and funds."""
        return await self._account_request(
            "getAccountFunds",
            {},
            session_token
        )
    
    async def list_market_catalogue(
        self, 
        session_token: str,
        filter_params: MarketFilter
    ) -> List[Dict[str, Any]]:
        """
        Retrieve market catalogue for horse racing.
        """
        # Build time filter
        now = datetime.now(timezone.utc)
        from_time = filter_params.from_time or now.isoformat()
        to_time = filter_params.to_time or (now + timedelta(days=1)).replace(
            hour=23, minute=59, second=59
        ).isoformat()
        
        params = {
            "filter": {
                "eventTypeIds": filter_params.event_type_ids,
                "marketTypeCodes": filter_params.market_type_codes,
                "marketStartTime": {
                    "from": from_time,
                    "to": to_time
                }
            },
            "marketProjection": [
                "RUNNER_DESCRIPTION",
                "MARKET_START_TIME",
                "EVENT",
                "COMPETITION"
            ],
            "sort": "FIRST_TO_START",
            "maxResults": filter_params.max_results
        }
        
        return await self._api_request("listMarketCatalogue", params, session_token)
    
    async def list_market_book(
        self, 
        session_token: str,
        request: MarketBookRequest
    ) -> List[Dict[str, Any]]:
        """
        Retrieve real-time market book with prices.
        Uses rate limiting per market.
        """
        params = {
            "marketIds": request.market_ids,
            "priceProjection": {
                "priceData": request.price_projection,
                "virtualise": request.virtualise
            }
        }
        
        # Rate limit by first market ID
        rate_key = request.market_ids[0] if request.market_ids else "default"
        
        return await self._api_request(
            "listMarketBook", 
            params, 
            session_token,
            rate_limit_key=rate_key
        )
    
    async def place_orders(
        self, 
        session_token: str,
        request: PlaceOrderRequest
    ) -> Dict[str, Any]:
        """
        Place a LAY bet on the exchange.
        """
        # Validate bet sizing rules
        potential_payout = request.stake * request.odds
        if request.stake < 1.0 and potential_payout < 10.0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Stakes below £1 require potential payout of £10 or greater"
            )
        
        params = {
            "marketId": request.market_id,
            "instructions": [
                {
                    "selectionId": request.selection_id,
                    "side": "LAY",
                    "orderType": "LIMIT",
                    "limitOrder": {
                        "size": round(request.stake, 2),
                        "price": round(request.odds, 2),
                        "persistenceType": request.persistence_type
                    }
                }
            ]
        }
        
        return await self._api_request(
            "placeOrders", 
            params, 
            session_token,
            rate_limit_key=request.market_id
        )
    
    async def cancel_orders(
        self,
        session_token: str,
        market_id: str,
        bet_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Cancel unmatched orders."""
        params = {"marketId": market_id}
        if bet_id:
            params["instructions"] = [{"betId": bet_id}]
        
        return await self._api_request("cancelOrders", params, session_token)
    
    async def list_current_orders(
        self,
        session_token: str,
        market_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """List current unmatched orders."""
        params = {}
        if market_ids:
            params["marketIds"] = market_ids
        
        return await self._api_request("listCurrentOrders", params, session_token)

# =============================================================================
# Application Lifecycle
# =============================================================================

betfair_client = BetfairClient()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    logger.info("Starting CHIMERA Lay Betting Backend")
    yield
    logger.info("Shutting down CHIMERA Lay Betting Backend")
    await betfair_client.close()

# =============================================================================
# FastAPI Application
# =============================================================================

app = FastAPI(
    title="CHIMERA Lay Betting API",
    description="Betfair Exchange integration for horse racing lay betting",
    version="1.1.0",
    lifespan=lifespan
)

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://*.pages.dev",
        "https://chimera-lay.pages.dev",
        "https://lay2.thync.online",
        "https://*.thync.online"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# Dependencies
# =============================================================================

async def get_session_token(x_authentication: str = Header(...)) -> str:
    """Extract and validate session token from header."""
    if not x_authentication:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token"
        )
    return x_authentication

# =============================================================================
# API Endpoints
# =============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint for Cloud Run."""
    return {
        "status": "healthy",
        "service": "chimera-lay-backend",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.get("/api/config")
async def get_config():
    """Debug endpoint to check configuration."""
    return {
        "login_url": config.BETFAIR_LOGIN_URL,
        "api_url": config.BETFAIR_API_URL,
        "account_url": config.BETFAIR_ACCOUNT_URL,
        "app_key_prefix": config.BETFAIR_APP_KEY[:8] + "...",
        "session_timeout_hours": config.SESSION_TIMEOUT_HOURS
    }

@app.post("/api/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """
    Authenticate with Betfair Exchange.
    Returns session token valid for 12 hours.
    """
    result = await betfair_client.login(request.username, request.password)
    return LoginResponse(**result)

@app.post("/api/auth/keepalive")
async def keep_alive(session_token: str = Depends(get_session_token)):
    """
    Extend session lifetime.
    Must be called within 12 hours of last auth.
    """
    return await betfair_client.keep_alive(session_token)

@app.post("/api/auth/logout")
async def logout(session_token: str = Depends(get_session_token)):
    """Terminate current session."""
    return await betfair_client.logout(session_token)

@app.post("/api/markets/catalogue")
async def get_market_catalogue(
    filter_params: MarketFilter = MarketFilter(),
    session_token: str = Depends(get_session_token)
):
    """
    Retrieve horse racing market catalogue.
    Filters: WIN markets, today's races.
    """
    return await betfair_client.list_market_catalogue(session_token, filter_params)

@app.post("/api/markets/book")
async def get_market_book(
    request: MarketBookRequest,
    session_token: str = Depends(get_session_token)
):
    """
    Get real-time prices for specified markets.
    Returns availableToLay for lay betting decisions.
    """
    return await betfair_client.list_market_book(session_token, request)

@app.post("/api/orders/place")
async def place_order(
    request: PlaceOrderRequest,
    session_token: str = Depends(get_session_token)
):
    """
    Place a LAY bet on the exchange.
    
    Bet Sizing Rules:
    - Minimum stake: £1
    - Stakes below £1 allowed if potential payout >= £10
    """
    return await betfair_client.place_orders(session_token, request)

@app.post("/api/orders/cancel")
async def cancel_order(
    market_id: str = Query(...),
    bet_id: Optional[str] = Query(None),
    session_token: str = Depends(get_session_token)
):
    """Cancel unmatched orders."""
    return await betfair_client.cancel_orders(session_token, market_id, bet_id)

@app.get("/api/orders/current")
async def get_current_orders(
    market_ids: Optional[str] = None,
    session_token: str = Depends(get_session_token)
):
    """
    List current unmatched orders.
    Optionally filter by market IDs (comma-separated).
    """
    ids = market_ids.split(",") if market_ids else None
    return await betfair_client.list_current_orders(session_token, ids)

@app.get("/api/account/balance")
async def get_account_balance(
    session_token: str = Depends(get_session_token)
):
    """
    Get account balance and available funds.
    Returns: availableToBetBalance, exposure, retainedCommission, pointsBalance, discountRate
    """
    return await betfair_client.get_account_funds(session_token)

# =============================================================================
# Error Handlers
# =============================================================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "code": str(exc.status_code)}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
