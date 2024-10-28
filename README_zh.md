# Splatoon WeChat Bot

[English](./README.md) | 中文

用于实时查询斯普拉遁 3 打工结果的微信机器人。

![](./docs/screenshot.png)

## 使用

**安装依赖**

```bash
npm install
```

**获取 NSO session token**

你可以使用 [`nxapi`](https://github.com/samuelthomas2774/nxapi) 获取。

```bash
nxapi nso auth
```

**配置 bot**

在项目的根目录创建一个 `.env` 文件，内容如下：

```env
# NSO session token
NT_SESSION_TOKEN="your_session_token_here"

# 管理员微信昵称
# （可选）.
ADMIN_WECHAT_NICKNAME="wechat_nickname_here"

# 群组名称，以英文逗号分隔
# （可选）默认情况下，机器人将响应所有群组）
ROOM_NAMES="room_1,room_2"

# 允许查询的时间间隔（毫秒）
# （可选，默认为 10000）
QUERY_THROTTLE=10000

# 查询命令格式
# 使用 '{@selfName}' 代表 '@机器人昵称'
# （可选，默认为 '{@selfName}'）
QUERY_COMMAND_FORMAT="{@selfName} query"

# 数据保存目录
# （可选，默认为 './data/work/'）
DATA_SAVE_PATH="./data/work/"

# 是否在统计中显示玩家名称
# （可选，默认为 false）
SHOW_PLAYER_NAME=true
```

**运行机器人**

```bash
npm start
```

也可以用 Docker 运行：

```bash
docker run -it \
    -v $(pwd)/.env:/app/.env \
    -v $(pwd)/data:/app/data \
    -v $(pwd)/credentials:/app/credentials \
    liang2kl/splatoon-bot-wechat:latest
```

启动后需要扫描二维码登录微信。账户必须通过实名认证并绑定银行卡才能成功登录。

**使用机器人**

在指定的群聊中，发送你在 `QUERY_COMMAND_FORMAT` 中设置的内容来查询最新的打工结果。如果没有设置，默认命令是 `@your_bot_nickname`。

管理员可以通过发送 `/splatoon stop` 来停止机器人，发送 `/splatoon start` 来重新启动机器人。