"""
InsightFlow AI Application Package
Ensures runtime compatibility across libraries and dependencies.
"""
import aiohttp

# Runtime patch for google-genai / aiohttp compatibility:
# google-genai catches aiohttp.ClientConnectorDNSError (introduced in aiohttp 3.10+).
# On environments with aiohttp < 3.10, define it as a subclass of ClientConnectorError
# to prevent `AttributeError: module 'aiohttp' has no attribute 'ClientConnectorDNSError'`.
if not hasattr(aiohttp, "ClientConnectorDNSError"):
    class ClientConnectorDNSError(aiohttp.ClientConnectorError):
        """Fallback for aiohttp < 3.10 where ClientConnectorDNSError is absent."""
        pass
    aiohttp.ClientConnectorDNSError = ClientConnectorDNSError
