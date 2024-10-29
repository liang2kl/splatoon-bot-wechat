import SplatNet3Api from "nxapi/splatnet3";

// type alias
type CoopHistoryDetail = Awaited<ReturnType<SplatNet3Api["getCoopHistoryDetail"]>>["data"]["coopHistoryDetail"];

const buildCoopSummary = (detail: CoopHistoryDetail, showNameInStats: boolean) => {
    let summary = buildCoopDescription(detail);
    summary += "\n\n" + buildCoopWaveResults(detail);
    summary += "\n\n----------------\n\n" + buildIndividualStats(detail, showNameInStats);
    summary += "\n\n----------------\n\n" + buildPlayerRankings(detail);

    return summary;
};

const buildCoopDescription = (detail: CoopHistoryDetail) => {
    return `${detail.coopStage.name} (${((detail.dangerRate ? detail.dangerRate : 0) * 100).toFixed(0)}%)`;
}

const buildCoopWaveResults = (detail: CoopHistoryDetail) => {
    let desc = "🌊 Wave Results:\n";
    detail.waveResults.forEach((wave, i) => {
        // green/red circle emoji
        const sign = detail.resultWave - 1 == i ? "🔴" : "🟢";
        desc += `\nWave ${wave.waveNumber} ${sign} ${wave.teamDeliverCount}(${wave.goldenPopCount})/${wave.deliverNorm}`;
    });
    if (detail.bossResult) {
        const sign = detail.bossResult.hasDefeatBoss ? "🔴" : "🟢";
        desc += `\nWave Extra ${sign}`;
    }
    return desc;
}

const buildIndividualStats = (detail: CoopHistoryDetail, showNameInStats: boolean) => {
    const resultDesc = (result: typeof detail.myResult | typeof detail.memberResults[number]) => {
        let desc = showNameInStats ? `${result.player.name}\n` : "";
        desc += `🟠🌕 ${result.deliverCount}  ${result.goldenDeliverCount}(${result.goldenAssistCount})`;
        desc += `\n🚑💀 ${result.rescueCount}-${result.rescuedCount}`;
        desc += `\n🔪 ${result.defeatEnemyCount}`;
        return desc;
    };

    let descs = [resultDesc(detail.myResult)];
    detail.memberResults.forEach((result) => {
        descs.push(resultDesc(result));
    });
    descs = descs.sort(() => Math.random() - 0.5);

    return `🦑 Statistics:\n\n` + `${descs.join("\n\n")}`;
}

const buildPlayerRankings = (detail: CoopHistoryDetail) => {
    type Result = typeof detail.myResult | typeof detail.memberResults[number];
    const score = (result: Result) => {
        return result.goldenDeliverCount + 0.5 * result.goldenAssistCount + 0.005 * result.deliverCount +
            result.defeatEnemyCount + 2 * (result.rescueCount - result.rescuedCount);
    }

    let rankings: Array<[Result, number]> = [[detail.myResult, score(detail.myResult)]];
    detail.memberResults.forEach((result) => {
        rankings.push([result, score(result)]);
    });
    rankings = rankings.sort((a, b) => (b[1] as number) - (a[1] as number));

    let desc = "🏆 Rankings:\n";
    rankings.forEach((ranking, i) => {
        desc += `\n${i + 1}. ${ranking[0].player.name} - ${ranking[1].toFixed(2)}`;
    });

    return desc;
}

export { buildCoopSummary, CoopHistoryDetail };