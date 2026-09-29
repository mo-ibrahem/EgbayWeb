# Egbay email delivery

The web and mobile apps already use the same Supabase Auth project. Both call
`resetPasswordForEmail`; the mobile app directs the recovery link to
`https://www.egbay.shop/reset-password`, and the web app also has that page.
Signed-in users can change their password in Settings. These calls do not send
mail from either app: Supabase Auth sends it using the project's mail settings.

## Production setup

1. In the production Supabase project's Authentication settings, check whether
   custom SMTP is enabled. The checked-in `supabase/config.toml` is for local
   development and does **not** prove the production setting.
2. Choose a transactional mail provider with SMTP support. Verify a sender
   domain under `egbay.shop`, publish the provider's SPF and DKIM records, and
   set a DMARC policy for that domain. Keep SMTP credentials in the Supabase
   dashboard, never in the mobile bundle, web client, or Git.
3. Set the Supabase Auth sender name to `Egbay` and a verified From address.
   Configure the provider's SMTP host, port, username, and password in
   Authentication → SMTP Settings. Disable click tracking for Auth emails so
   that verification and recovery links are not rewritten.
4. In Supabase Auth URL Configuration, set the Site URL to
   `https://www.egbay.shop` and allow
   `https://www.egbay.shop/reset-password` as a redirect. Confirm the web
   deployment uses the same `NEXT_PUBLIC_SITE_URL`.
5. Review the signup confirmation, password recovery, and email change
   templates in English and Arabic. Decide whether email confirmation should
   be required before changing that Auth setting; turning it on changes how
   both signup screens behave.
6. Test signup, recovery, expired links, and email change with two real inboxes
   outside the Supabase team. Check delivery and spam placement. Then adjust
   Auth email rate limits for expected traffic and enable abuse protection.

Supabase's built-in sender is limited to project team addresses and currently
has a two-email-per-hour project limit. It is unsuitable for public production
delivery. A successful `resetPasswordForEmail` response does not prove that an
account exists or that an email was delivered.

## Other emails

Order, chat, and review activity currently appears as in-app notifications.
If Egbay adds email notifications, generate them on the server from canonical
events, use an idempotent queue, and let users control their preferences.
Keep these operational messages separate from marketing. Do not add marketing
email until there is explicit consent, a preference record, and a free opt-out
in every message, as required by Egypt's PDPC guidance.

Sources: [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp),
[Supabase password recovery](https://supabase.com/docs/guides/auth/passwords),
[Egypt PDPC](https://www.pdpc.gov.eg/).
