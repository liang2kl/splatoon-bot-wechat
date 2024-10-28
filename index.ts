import * as dotenv from 'dotenv'
dotenv.config()

import { WechatyBuilder, Message } from 'wechaty'
import CoralApi, { CoralAuthData } from 'nxapi/coral';
import SplatNet3Api, { SplatNet3AuthData } from 'nxapi/splatnet3';
import { ErrorResponse } from 'nxapi';
import { Response } from 'node-fetch';
import fs from 'fs';
import { throttle } from './util';
import { buildCoopSummary } from './splatoon'

const wechaty = WechatyBuilder.build({ name: "splatoon-bot" }); // get a Wechaty instance
const messageHandler = throttle((message: Message) => handleMessage(message), 20000);
wechaty
    .on('scan', (qrcode, status) => console.log(`Scan QR Code to login: ${status}\nhttps://wechaty.js.org/qrcode/${encodeURIComponent(qrcode)}`))
    .on('login', user => console.log(`User ${user} logged in`))
    .on('message', message => messageHandler(message));

let coral: CoralApi;
let coral_auth_data: CoralAuthData;
let splatnet3: SplatNet3Api;
let splatnet3_auth_data: SplatNet3AuthData;

const initAuth = async () => {
    const token = process.env.NT_SESSION_TOKEN;
    if (!token) throw new Error("NT_SESSION_TOKEN is not set");
    const { nso, data } = await getCachedCoralAuthData(token);
    coral = nso;
    coral_auth_data = data;
    const splat3 = await getCachedSplatNet3AuthData(coral, coral_auth_data.user);
    splatnet3 = splat3.splatnet;
    splatnet3_auth_data = splat3.data;

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

const onSplatNet3TokenExpired = async (response: Response) => {
    try {
        // This should be cached - using stale data is fine, as only the user data is used
        const data = await SplatNet3Api.loginWithWebServiceToken(splatnet3_auth_data.webserviceToken, coral_auth_data.user);
        // data is a plain object of type SplatNet3AuthData
        // data should be saved and reused

        splatnet3_auth_data = data;
        saveSplatNet3AuthData(data);

        return data;
    } catch (err) {
        // `401 Unauthorized` from `/api/bullet_tokens` means the web service token has expired (or is invalid)
        if (err instanceof ErrorResponse && err.response.status === 401) {
            const data = await SplatNet3Api.loginWithCoral(coral, coral_auth_data.user);
            // data is a plain object of type SplatNet3AuthData
            // data should be saved and reused
            splatnet3_auth_data = data;
            saveSplatNet3AuthData(data);
            return data;
        }
        throw err;
    }

}

const handleMessage = async (message) => {
    const selfName = wechaty.currentUser.name();
    const text = message.text();
    if (!text.includes("@" + selfName)) return;
    const room = message.room();
    if (!room) return;
    // const roomIds = process.env.ROOM_IDS?.split(',').filter((id) => id == room.id);
    // if (roomIds != undefined && roomIds.length == 0) return;

    console.log("Start fetching data...");
    const resp = await splatnet3.getCoopHistoryLatest();
    const detailResp = await splatnet3.getCoopHistoryDetail(
        resp.data.coopResult.historyGroupsOnlyFirst.nodes[0].historyDetails.nodes[0].id);
    const reply = buildCoopSummary(detailResp.data.coopHistoryDetail);
    console.log("Sending message...");
    room.say(reply);
}

await initAuth();
await wechaty.start();
