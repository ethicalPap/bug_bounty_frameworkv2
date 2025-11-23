"""
Vulnerability Validation Package
Active testing modules for confirming security vulnerabilities
"""

from .webapp_validator import (
    WebAppValidator,
    VulnerabilityProof,
    calculate_validated_risk_score
)
from .browser_validator import (
    BrowserValidator,
    validate_high_value_target
)

__all__ = [
    'WebAppValidator',
    'VulnerabilityProof',
    'calculate_validated_risk_score',
    'BrowserValidator',
    'validate_high_value_target',
]

__version__ = "1.0.0"