import * as dotenv from 'dotenv'
dotenv.config()

import { WechatyBuilder, Message } from 'wechaty'
import CoralApi, { CoralAuthData, CoralErrorResponse } from 'nxapi/coral';
import SplatNet3Api, { SplatNet3AuthData } from 'nxapi/splatnet3';
import { ErrorResponse } from 'nxapi';
import { Response } from 'node-fetch';
import fs from 'fs';
import { throttle, log } from './util';
import { buildCoopSummary, buildScheduleSummary, CoopHistoryDetail } from './splatoon'

const wechaty = WechatyBuilder.build({ name: "splatoon-bot" });
const queryThrottle = parseInt(process.env.QUERY_THROTTLE ?? "10000");
const throttledQueryHandler = throttle(
    (handler: (_: Message) => void, message: Message) => handleQuery(handler, message), queryThrottle);
const credentialsDir = "./credentials";

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
    makeDirIfNotExist(credentialsDir);
    if (!fs.existsSync(credentialsDir + "/coral_auth_data.json")) {
        const resp = await CoralApi.createWithSessionToken(token);
        updateLangCode(resp.data);
        saveCoralAuthData(resp.data);
        return resp;
    }
    const data = fs.readFileSync(credentialsDir + "/coral_auth_data.json", "utf-8");
    return {
        nso: CoralApi.createWithSavedToken(JSON.parse(data)),
        data: JSON.parse(data)
    }
}

const saveCoralAuthData = (data: CoralAuthData) => {
    makeDirIfNotExist(credentialsDir);
    fs.writeFileSync(credentialsDir + "/coral_auth_data.json", JSON.stringify(data));
}

const getCachedSplatNet3AuthData = async (coral: CoralApi, user: CoralAuthData['user']) => {
    if (!fs.existsSync(credentialsDir + "/splatnet3_auth_data.json")) {
        const resp = await SplatNet3Api.loginWithCoral(coral, user);
        saveSplatNet3AuthData(resp);
        return {
            splatnet: SplatNet3Api.createWithSavedToken(resp),
            data: resp
        }
    }
    const data = fs.readFileSync(credentialsDir + "/splatnet3_auth_data.json", "utf-8");
    return {
        splatnet: SplatNet3Api.createWithSavedToken(JSON.parse(data)),
        data: JSON.parse(data)
    }
}

const saveSplatNet3AuthData = (data: SplatNet3AuthData) => {
    makeDirIfNotExist(credentialsDir);
    fs.writeFileSync(credentialsDir + "/splatnet3_auth_data.json", JSON.stringify(data));
}

const onCoralTokenExpired = async (error: any, response: any) => {
    const data = await CoralApi.createWithSessionToken(process.env.NT_SESSION_TOKEN!);
    coral = data.nso;
    coral_auth_data = data.data;
    updateLangCode(data.data);
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
            onCoralTokenExpired(null, null);
            const data = await SplatNet3Api.loginWithCoral(coral, coral_auth_data.user);
            splatnet3_auth_data = data;
            saveSplatNet3AuthData(data);
            return data;
        }
        throw err;
    }

}

const updateLangCode = async (data: typeof coral_auth_data) => {
    const code = process.env.LANG_CODE;
    if (!code) return;
    data.user.language = code;
};

const makeDirIfNotExist = (dir: string) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        return true;
    }
    return false;
}

const handleMessage = async (message: Message) => {
    if (message.self()) {
        log('Message discarded because it is sent by myself')
        return
    }

    if (message.age() > 2 * 60) {
        log('Message discarded because its too old (more than 2 minutes)')
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
    if (!room) {
        log("Message discarded because it is not in a room");
        return;
    }

    const handler = await getHandler(message);
    if (!handler) {
        log("No handler found for the message");
        return;
    }

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

    if (currently_stopped) {
        message.say("I'm currently stopped. Please wait for the admin to start me.");
        return;
    }

    let executed = throttledQueryHandler(handler, message);
    if (!executed) {
        log("Query not executed due to throttling");
        message.say("Please wait a moment before querying again.");
    }
}

const getHandler = async (message: Message) => {
    const availableCommands: Array<[string, (_: Message) => void]> = [
        [process.env.QUERY_LAST_WORK_COMMAND_FORMAT ?? "{@selfName}", handleCoopResultQuery],
        [process.env.QUERY_SCHEDULE_COMMAND_FORMAT ?? "{@selfName} schedule", handleScheduleQuery],
    ]
    const selfName = await message.room()?.alias(wechaty.currentUser) ?? wechaty.currentUser.name();
    // Wechat uses special space character for @name
    const messageVal = message.text().trim().replace(" ", " ");

    for (const [command, handler] of availableCommands) {
        if (messageVal == command.replace("{@selfName}", "@" + selfName)) {
            return handler;
        }
    }

    return null;
}

const handleQuery = async (handler: (_: Message) => void, message: Message) => {
    handler(message);
}

const handleCoopResultQuery = async (message: Message) => {
    log("Handling coop result query");
    const resp = await splatnet3.getCoopHistoryLatest();
    const detailResp = await splatnet3.getCoopHistoryDetail(
        resp.data.coopResult.historyGroupsOnlyFirst.nodes[0].historyDetails.nodes[0].id);
    const reply = buildCoopSummary(
        detailResp.data.coopHistoryDetail);
    saveCoopDetails(detailResp.data.coopHistoryDetail);
    message.say(reply);
    log("Coop result query done");
}

const handleScheduleQuery = async (message: Message) => {
    log("Handling schedule query");
    const resp = await splatnet3.getSchedules();
    const schedules = resp.data.coopGroupingSchedule;
    const reply = buildScheduleSummary(schedules);
    message.say(reply);
    log("Schedule query done");
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
    const path = `${dir}/${detail.playedTime}-${detail.coopStage.id}-${detail.id.substring(0, 10)}.json`;
    fs.writeFileSync(path, JSON.stringify(detail));
}

await initAuth();
await wechaty.start();
