// prisma ArtRewardActivity data access object

import {
    type ArtRewardActivityDAO,
    RewardActivityStatus,
} from "./art_reward_activity_dao.ts";
import { elizaLogger } from "@elizaos/core";
import { v4 as uuidV4 } from "uuid";
import type { EthTransfer } from "./art_reward_transfer.ts";

export class ArtRewardActivitySchedule {
    private artRewardActivityDAO: ArtRewardActivityDAO;
    private ethTransfer: EthTransfer;

    constructor(
        artRewardActivityDAO: ArtRewardActivityDAO,
        ethTransfer: EthTransfer
    ) {
        this.artRewardActivityDAO = artRewardActivityDAO;
        this.ethTransfer = ethTransfer;
    }

    async start(): Promise<void> {
        const handleLoop = () => {
            this.task();
            setTimeout(
                handleLoop,
                // Defaults to 20 seconds
                20 * 1000
            );
        };
        handleLoop();

        elizaLogger.log("ArtRewardActivity schedule loop started");
    }

    // schedule refresh db key value
    private async task(): Promise<void> {
        // new uuid
        const uuid: string = uuidV4();

        const tasks = await this.artRewardActivityDAO.batchArtRewardActivity(
            uuid,
            20
        );
        if (tasks.length === 0) {
            return;
        }
        for (const task of tasks) {
            try {
                const txHash = await this.ethTransfer.transferAmount(
                    task.wonAddress,
                    task.rewardAmount
                );
                await this.artRewardActivityDAO.updateArtAwardStatus(
                    task.id,
                    RewardActivityStatus.AWARDED_SUCCESS,
                    txHash
                );
            } catch (e) {
                elizaLogger.log(`transferAmount ${task.id} failed: ` + e);
                await this.artRewardActivityDAO.updateArtAwardStatus(
                    task.id,
                    RewardActivityStatus.AWARDED_FAILED,
                    e.toString()
                );
            }
        }
    }
}
