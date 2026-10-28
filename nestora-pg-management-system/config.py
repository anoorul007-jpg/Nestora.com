import os

class Config:
    # Flask Secrets & Security
    SECRET_KEY = os.environ.get('SECRET_KEY', 'nestora_cryptographic_secret_key_2026_x89a')
    TOKEN_SECRET = os.environ.get('TOKEN_SECRET', 'nestora_token_signing_key_9921_beta')

    # Database Settings
    USE_MYSQL = os.environ.get('USE_MYSQL', 'False').lower() in ('true', '1', 't')
    MYSQL_HOST = os.environ.get('MYSQL_HOST', 'localhost')
    MYSQL_PORT = int(os.environ.get('MYSQL_PORT', 3306))
    MYSQL_USER = os.environ.get('MYSQL_USER', 'root')
    MYSQL_PASSWORD = os.environ.get('MYSQL_PASSWORD', '')
    MYSQL_DB = os.environ.get('MYSQL_DB', 'nestora_pg_db')

    # SQLite Database File Path (Default fallback)
    SQLITE_PATH = os.path.join(os.path.dirname(__file__), 'nestora.db')

    # SMS Gateway Settings ('twilio', 'generic_http', 'sandbox')
    SMS_PROVIDER = os.environ.get('SMS_PROVIDER', 'sandbox').lower()
    TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID', '')
    TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN', '')
    TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER', '')

    SMS_API_URL = os.environ.get('SMS_API_URL', '')
    SMS_API_KEY = os.environ.get('SMS_API_KEY', '')

    # OTP Security Parameters
    OTP_EXPIRY_MINUTES = 5
    OTP_RESEND_COOLDOWN_SECONDS = 60
    OTP_MAX_ATTEMPTS = 3

    # File Uploads
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'uploads')
    MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5 MB max upload
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}
