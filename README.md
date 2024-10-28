# Splatoon WeChat Bot

Wechat bot for querying Splatoon 3 work (Salmon Run) results.

Contributions are welcome! Feel free to open an issue or a pull request if you have any suggestions or improvements.

## Usage

**Install dependencies**

```bash
npm install
```

**Obtain a session token of your Nintendo Switch Online (NSO) account**

You can use [`nxapi`](https://github.com/samuelthomas2774/nxapi) to get it.

```bash
nxapi nso auth
```

**Configure the bot**

Create a `.env` file in the root directory of the project with the following content:

```env
# NSO session token
NT_SESSION_TOKEN="your_session_token_here"

# WeChat nickname of admin
# (optional).
ADMIN_WECHAT_NICKNAME="wechat_nickname_here"

# Names of groups to respond to
# (optional, by default the bot will respond to
#  all groups)
ROOM_NAMES="room_1,room_2"

# Query throttling in milliseconds
# (optional, default is 10000)
QUERY_THROTTLE=10000

# Query command format
# Use '{@selfName}' to represent '@your_bot_nickname'
# (optional, default is '{@selfName}')
QUERY_COMMAND_FORMAT="{@selfName} query"

# Data save directory
# (optional, default is './data/work/')
DATA_SAVE_PATH="./data/work/"

# Show the username of the player in statistics
# (optional, default is false)
SHOW_PLAYER_NAME=true
```

**Run the bot**

```bash
npm start
```

You will need to scan the QR code to log in to WeChat. Your account must be real-name verified with a credit/debit card in order to login successfully.

**Use the bot**

In the designated group chats, send whatever you set in `QUERY_COMMAND_FORMAT` to query the latest Salmon Run results. If not set, the default command is `@your_bot_nickname`.

You can stop the bot from responding to queries by sending `/splatoon stop` by the admin. You can restart the bot by sending `/splatoon start`.