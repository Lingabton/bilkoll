"""Abstract interface for price sources."""


class PriceSource:
    """Abstract interface for price sources.
    Makes it possible to swap AutoUncle for Bytbil/Blocket
    without rewriting the rest of the system."""

    def fetch_prices(self, make, model, fuel_filter, year) -> dict:
        """Fetch price data for a specific model+year.
        Returns: {median_price, p5_price, p95_price, count, median_mileage_mil}
        """
        raise NotImplementedError
