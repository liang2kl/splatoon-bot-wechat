# Splatoon WeChat Bot

Wechat Bot for querying Splatoon 3 work (Salmon Run) results.

To run:

**Install dependencies**

```bash
npm install
```

**Obtain a session token of your Nintendo Account**

You can use [`nxapi`](https://github.com/samuelthomas2774/nxapi) to get it.

**Set environment**

Create a `.env` file in the root directory of the project with the following content:

```env
# NSO session token
NT_SESSION_TOKEN="your_session_token_here"

# WeChat nickname of admin (optional).
ADMIN_WECHAT_NICKNAME="wechat_nickname_here"

# Room names of groups to respond to
# (optional, by default the bot will respond to
#  all groups)
ROOM_NAMES="room_id_1,room_id_2"

# Query throttling in milliseconds
# (optional, default is 10000)
QUERY_THROTTLE=10000

# Query command format
# Use "{@selfName}" to represent '@<bot>'
# (optional, default is '{@selfName}')
QUERY_COMMAND_FORMAT="{@selfName} query"
```

**Run the bot**

```bash
npm start
```

You will need to scan the QR code to log in to WeChat. Your account must be real-name verified and add a credit/debit card in order to login successfully.

**Use the bot**

In any group chat, send whatever you set in `QUERY_COMMAND_FORMAT` to query the latest Salmon Run results. If not set, the default command is `@<bot>`.

You can stop the bot from responding queries by sending `/splatoon stop` by the admin. You can restart the bot by sending `/splatoon start`.