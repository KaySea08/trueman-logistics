# Customer service channels and logo — manual setup

## Add a direct phone-call link

1. Open the project root `.env` file in VS Code.
2. Add your real China customer service number in international E.164 format:

   ```dotenv
   VITE_SUPPORT_PHONE=+86YOURREALNUMBER
   ```

3. Save the file.
4. Restart the web service:

   ```powershell
   docker compose restart web
   ```

5. Open the website on a phone and tap **Call customer service**. The `tel:` link opens the device's dialer or configured calling app. A desktop browser may ask which calling application to use.

## Add WhatsApp

1. Use the number registered with WhatsApp, including the country code, without plus sign, spaces or punctuation:

   ```dotenv
   VITE_SUPPORT_WHATSAPP=86YOURWHATSAPPNUMBERWITHOUTPLUS
   ```

2. Save `.env` and restart `web` as above.
3. Test the WhatsApp link on a device where WhatsApp is installed or WhatsApp Web is available.

## Replace the temporary logo mark with the approved company logo

1. Create/open `apps/web/public/images/`.
2. Copy your transparent horizontal logo artwork into that folder using these exact names:
   - `trueman-logo.svg` — red/dark logo for light backgrounds.
   - `trueman-logo-white.svg` — white logo for dark backgrounds.
3. If the artwork is PNG instead, convert it to SVG or update the two image paths in `apps/web/src/components/Brand.tsx` to the matching `.png` filenames.
4. Restart the web service and refresh the page.

The Brand component automatically uses the image when it exists. If the file is missing, it falls back to the current icon-and-wordmark so the page does not break.

## Service inquiries

Each shipping service card now opens a structured inquiry form. It asks for the customer's name, email, optional phone/WhatsApp number and message, then saves the inquiry through the API in PostgreSQL. The form is not an email link. A staff-facing inquiry queue and automatic assignment are planned for the operations/support dashboard phase.
