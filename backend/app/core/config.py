import os
from functools import lru_cache

from dotenv import load_dotenv

# Load variables from backend/.env
load_dotenv()


class Settings:
    def __init__(self) -> None:
        self.DATABASE_URL: str = os.getenv("DATABASE_URL", "")
        self.SECRET_KEY: str = os.getenv("SECRET_KEY", "change_me")
        self.ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
        self.ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
            os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
        )

        if not self.DATABASE_URL:
            raise ValueError("DATABASE_URL is not set in the .env file.")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()