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
npm install -g nxapi
nxapi nso auth
```

根据提示获取 session token。

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

# 数据保存目录
# （可选，默认为 './data/work/'）
DATA_SAVE_PATH="./data/work/"

# 是否在统计中显示玩家名称
# （可选，默认为 false）
SHOW_PLAYER_NAME=true

# 时区
# （可选，默认为 'Asia/Shanghai'）
TIMEZONE="Asia/Shanghai"

# 语言
# （可选，默认为 NSO 账户设置语言）
LANGUAGE="zh-CN"

# 分数计算公式
# （可选，默认为：
#   {goldDeliver} + 0.5 * {goldAssist}
#   + 0.005 * {deliver} + {defeatEnemy}
#   + 2 * ({rescue} - {death})
#  ）
# 可以使用以下变量：
#   {goldDeliver} - 金蛋数量
#   {goldAssist} - 金蛋助攻数量
#   {deliver} - 红蛋数量
#   {defeatEnemy} - 击败敌人数量
#   {rescue} - 救援次数
#   {death} - 死亡次数
SCORING_FUNCTION="..."

# 查询最新打工命令格式
# 使用 '{@selfName}' 代表 '@机器人昵称'
# （可选，默认为 '{@selfName}'）
QUERY_LAST_WORK_COMMAND_FORMAT="{@selfName}"

# 查询打工日历命令格式
# （可选，默认为 '{@selfName} schedule'）
QUERY_SCHEDULE_COMMAND_FORMAT="{@selfName} schedule"
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

在指定的群聊中，使用你在 `.env` 中设置的命令或使用默认命令与机器人进行交互，其中 `@bot_nickname` 为机器人在群中的昵称。

| 命令 | 默认值 | 描述 |
| --- | --- | --- |
| `QUERY_LAST_WORK_COMMAND_FORMAT` | `@bot_nickname` | 查询最新的打工结果 |
| `QUERY_SCHEDULE_COMMAND_FORMAT` | `@bot_nickname schedule` | 查询打工日历 |

你可以通过使用管理员微信账户发送以下命令来控制机器人：

| 命令 | 描述 |
| --- | --- |
| `/splatoon stop` | 停止机器人响应查询 |
| `/splatoon start` | 重新启动机器人 |
