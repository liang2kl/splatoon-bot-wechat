import * as dotenv from 'dotenv'
dotenv.config()

import { WechatyBuilder, Message } from 'wechaty'
import CoralApi, { CoralAuthData, CoralErrorResponse } from 'nxapi/coral';
import SplatNet3Api, { SplatNet3AuthData } from 'nxapi/splatnet3';
import { ErrorResponse } from 'nxapi';
import { Response } from 'node-fetch';
import fs from 'fs';
import { throttle, log } from './util';
import { buildCoopSummary, CoopHistoryDetail } from './splatoon'

const wechaty = WechatyBuilder.build({ name: "splatoon-bot" }); // get a Wechaty instance
const queryThrottle = parseInt(process.env.QUERY_THROTTLE ?? "10000");
const queryMessageHandler = throttle((message: Message) => handleCoopResultQuery(message), queryThrottle);

wechaty
    .on('scan', (qrcode, status) => log(`Scan QR Code to login: ${status}\nhttps://wechaty.js.org/qrcode/${encodeURIComponent(qrcode)}`))
    .on('login', user => log(`User ${user} logged in`))
    .on('message', message => handleMessage(message));

let coral: CoralApi;
let coral_auth_data: CoralAuthData;
let splatnet3: SplatNet3Api;
let splatnet3_auth_data: SplatNet3AuthData;
let currently_stopped = false;

const initAuth = async () => {
    const token = process.env.NT_SESSION_TOKEN;
    if (!token) throw new Error("NT_SESSION_TOKEN is not set");
    const { nso, data } = await getCachedCoralAuthData(token);
    coral = nso;
    coral_auth_data = data;
    const splat3 = await getCachedSplatNet3AuthData(coral, coral_auth_data.user);
    splatnet3 = splat3.splatnet;
    splatnet3_auth_data = splat3.data;

    coral.onTokenExpired = onCoralTokenExpired;
    splatnet3.onTokenExpired = onSplatNet3TokenExpired;
}

const getCachedCoralAuthData = async (token: string) => {
    if (!fs.existsSync("coral_auth_data.json")) {
        const resp = await CoralApi.createWithSessionToken(token);
        saveCoralAuthData(resp.data);
        return resp;
    }
    const data = fs.readFileSync("coral_auth_data.json", "utf-8");
    return {
        nso: CoralApi.createWithSavedToken(JSON.parse(data)),
        data: JSON.parse(data)
    }
}

const saveCoralAuthData = (data: CoralAuthData) => {
    fs.writeFileSync("coral_auth_data.json", JSON.stringify(data));
}

const getCachedSplatNet3AuthData = async (coral: CoralApi, user: CoralAuthData['user']) => {
    if (!fs.existsSync("splatnet3_auth_data.json")) {
        const resp = await SplatNet3Api.loginWithCoral(coral, user);
        saveSplatNet3AuthData(resp);
        return {
            splatnet: SplatNet3Api.createWithSavedToken(resp),
            data: resp
        }
    }
    const data = fs.readFileSync("splatnet3_auth_data.json", "utf-8");
    return {
        splatnet: SplatNet3Api.createWithSavedToken(JSON.parse(data)),
        data: JSON.parse(data)
    }
}

const saveSplatNet3AuthData = (data: SplatNet3AuthData) => {
    fs.writeFileSync("splatnet3_auth_data.json", JSON.stringify(data));
}

const onCoralTokenExpired = async (_: CoralErrorResponse, response: Response) => {
    const data = await CoralApi.createWithSessionToken(process.env.NT_SESSION_TOKEN!);
    coral = data.nso;
    coral_auth_data = data.data;
    saveCoralAuthData(data.data);
    return data.data;
}

const onSplatNet3TokenExpired = async (response: Response) => {
    try {
        const data = await SplatNet3Api.loginWithWebServiceToken(splatnet3_auth_data.webserviceToken, coral_auth_data.user);
        splatnet3_auth_data = data;
        saveSplatNet3AuthData(data);
        return data;
    } catch (err) {
        if (err instanceof ErrorResponse && err.response.status === 401) {
            const data = await SplatNet3Api.loginWithCoral(coral, coral_auth_data.user);
            splatnet3_auth_data = data;
            saveSplatNet3AuthData(data);
            return data;
        }
        throw err;
    }

}

const handleMessage = async (message: Message) => {
    if (message.self()) {
        console.info('Message discarded because it is sent by myself')
        return
    }

    if (message.age() > 2 * 60) {
        console.info('Message discarded because its too old (more than 2 minutes)')
        return
    }

    log(`Message received from ` +
        (message.talker() ? message.talker()!.name().toString() : "Unknown") + " in " +
        (message.room() ? await message.room()!.topic() : "PM") +
        `: "${message.text().substr(0, 10)}"` + (message.text().length > 10 ? "..." : "")
    );
    if (message.talker()?.name() == process.env.ADMIN_WECHAT_NICKNAME?.trim() && !message.room()) {
        return handleAdminMessage(message);
    }
    const room = message.room();
    if (!room) return;

    const selfName = await message.room()?.alias(wechaty.currentUser) ?? wechaty.currentUser.name();
    const text = message.text();
    const command = process.env.QUERY_COMMAND_FORMAT?.replace("{@selfName}", "@" + selfName)
        ?? `@${selfName}`;

    if (text.trim() != command) return;

    const topic = await room.topic();
    const roomNames = process.env.ROOM_NAMES;
    if (roomNames) {
        const isWhitelisted = roomNames.split(',')
            .filter((name) => name.trim() == topic)
            .length > 0;
        if (!isWhitelisted) {
            log(`Room ${topic} is not whitelisted`);
            return;
        }
    }

    queryMessageHandler(message);
}

const handleCoopResultQuery = async (message: Message) => {
    if (currently_stopped) {
        message.say("I'm currently stopped. Please wait for the admin to start me.");
        return;
    }

    log("Fetching data...");
    const resp = await splatnet3.getCoopHistoryLatest();
    const detailResp = await splatnet3.getCoopHistoryDetail(
        resp.data.coopResult.historyGroupsOnlyFirst.nodes[0].historyDetails.nodes[0].id);
    const reply = buildCoopSummary(
        detailResp.data.coopHistoryDetail,
        process.env.SHOW_PLAYER_NAME?.toLowerCase() == "true");
    log("Saving data...");
    saveCoopDetails(detailResp.data.coopHistoryDetail);
    log("Sending message...");
    message.say(reply);
    log("Message sent");
}

const handleAdminMessage = async (message: Message) => {
    const text = message.text();
    if (!text.startsWith("/splatoon")) {
        return;
    }
    const command = text.split(" ")[1];
    log("Admin command: " + command);

    if (command == "stop") {
        currently_stopped = true;
        await message.say(wechaty.name() + " stopped");
    } else if (command == "start") {
        currently_stopped = false;
        await message.say(wechaty.name() + " started");
    } else {
        await message.say("Unknown command");
    }
}

const saveCoopDetails = async (detail: CoopHistoryDetail) => {
    const dir = process.env.DATA_SAVE_PATH ?? "./data/work";
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const path = `${dir}/${detail.playedTime}-${detail.coopStage.name}-${detail.id}.json`;
    fs.writeFileSync(path, JSON.stringify(detail));
}

await initAuth();
await wechaty.start();
