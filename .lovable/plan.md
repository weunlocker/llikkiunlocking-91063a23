## Goal
Make Telegram price-change / new-service broadcasts look like the screenshot, and also post them to the channel already configured in Admin (`site_settings.telegram_channel_id`).

## New message format

For price change (decrease):
```
🔄 Latest Price Updates 💰

Stay informed about our latest product adjustments! 🎯

🛍️ <b>{Service Name}</b>
📉 Price decreased 🛒
💵 Old Price: 20.19 USD
💰 New Price: 18.69 USD
```

For price increase: swap line to `📈 Price increased 🛒`.

For new service:
```
🆕 New Service Available 🎯

🛍️ <b>{Service Name}</b>
💰 Price: 18.69 USD
```

All amounts shown as `X.XX USD` (matches screenshot).

## Changes

**`supabase/functions/broadcast-service-update/index.ts`**
1. Build the formatted HTML message using the template above (decide decreased vs increased from `old_price` vs `new_price`).
2. Fetch `telegram_channel_id` from `site_settings` (id=1).
3. If `telegram_channel_id` is set and client bot token exists: send one message to that channel via `sendMessage` (chat_id = channel id).
4. Keep existing per-user DM broadcast to linked clients (unchanged behavior, just the new formatted text).
5. Return counts including `channel_posted: true/false`.

No DB changes, no UI changes, no other files touched. Admin's existing "Channel ID" setting is reused as-is.
