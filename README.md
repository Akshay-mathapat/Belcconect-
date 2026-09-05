# BelConnect / CityConnect

## Brevo SMTP Password Reset Setup

To enable real transactional email delivery for the Forgot Password flow using Brevo SMTP:

1. Create or log in to your **Brevo** account (formerly Sendinblue).
2. Navigate to **Senders & IP** in Brevo and verify your sender email domain or address (e.g. `no-reply@belconnect.com` or your verified sender email).
3. Navigate to **SMTP & API** settings in Brevo to obtain your SMTP credentials.
4. Add the following environment variables to your `.env` file (never commit `.env` or real SMTP credentials to version control):

```env
# Brevo SMTP Relay Configuration
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false

# Your Brevo SMTP Login (e.g. your registered Brevo account email)
SMTP_USER=your_brevo_smtp_login

# Your Brevo Master SMTP Key
SMTP_PASS=your_brevo_smtp_key

# Verified Sender Address in Brevo
SMTP_FROM_EMAIL=no-reply@belconnect.com
SMTP_FROM_NAME=BelConnect

# Password Reset Security Parameters
PASSWORD_RESET_OTP_SECRET=your_secure_hmac_secret
PASSWORD_RESET_OTP_TTL_MINUTES=10
PASSWORD_RESET_RESEND_SECONDS=60
```

5. Restart the Next.js development server (`npm run dev`) after updating `.env`.

