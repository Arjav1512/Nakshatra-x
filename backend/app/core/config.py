import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "MOIL Space Intelligence API"
    environment: str = "development"
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./moil.db")
    jwt_secret: str = "replace_with_a_long_random_secret"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 30
    # Upstream base URLs, overridable by env.
    #
    # NAKSHATRA_OFFLINE=1 points every one of them at the discard port, which
    # refuses immediately rather than hanging. That is how the provenance
    # guard's offline run makes "no data reachable" true for the server as well
    # as the browser: Puppeteer can abort the browser's requests, but not a
    # fetch this process makes.
    nasa_power_base_url: str = "https://power.larc.nasa.gov/api"
    stac_base_url: str = "https://earth-search.aws.element84.com"
    open_meteo_base_url: str = "https://api.open-meteo.com"
    offline: bool = False
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore",
                                      env_prefix="", case_sensitive=False)

    from pydantic import model_validator
    @model_validator(mode="after")
    def validate_production_secrets(self) -> 'Settings':
        if self.environment == "production":
            if self.jwt_secret in ("replace_with_a_long_random_secret", "replace_with_a_long_random_secret_moil_defense_grade_2026", ""):
                raise ValueError("JWT_SECRET must be set to a secure custom value in production environment.")
        return self

settings = Settings()

# Discard port: connections are refused at once, so a degraded path is
# exercised at speed instead of timing out.
OFFLINE_SINK = "http://127.0.0.1:9"

if os.getenv("NAKSHATRA_OFFLINE") == "1":
    settings.offline = True
    settings.nasa_power_base_url = f"{OFFLINE_SINK}/api"
    settings.stac_base_url = OFFLINE_SINK
    settings.open_meteo_base_url = OFFLINE_SINK
