# API smoke test

After starting the backend and initializing the database:

```bash
export API='https://YOUR_DOMAIN'
export TOKEN='YOUR_ADMIN_TOKEN'

curl -s "$API/health"

curl -s -X POST "$API/api/senders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label":"Nomor Toko","phone":"+628123456789","kind":"business"}'

curl -s "$API/api/senders" \
  -H "Authorization: Bearer $TOKEN"
```

The `business` sender remains `needs_meta_onboarding` until the official Meta Embedded Signup / Cloud API integration is configured. The `personal` sender remains `manual_link_required`. Neither status means the WhatsApp account has been connected.
