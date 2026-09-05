from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    music_directory: str = "/home/d3f4ult0/Music"

    class Config:
        env_file = ".env"


settings = Settings()
