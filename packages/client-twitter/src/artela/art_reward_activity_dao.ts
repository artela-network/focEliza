// prisma ArtRewardActivity data access object
import { PrismaClient, type ArtRewardActivity } from "@prisma/client";

export enum RewardActivityStatus {
    INIT = 0,
    WON = 1,
    AWARDING = 2,
    AWARDED_SUCCESS = 3,
    AWARDED_FAILED = 4,
}

export class ArtRewardActivityDAO {
    private prisma: PrismaClient;

    constructor(dataSource?: string) {
        if (!dataSource) {
            this.prisma = new PrismaClient({
                datasourceUrl: dataSource,
            });
        } else {
            this.prisma = new PrismaClient();
        }
    }

    async addArtRewardActivity(
        data: Omit<ArtRewardActivity, "id" | "createdAt" | "updatedAt">
    ): Promise<ArtRewardActivity> {
        return this.prisma.artRewardActivity.create({
            data: {
                ...data,
            },
        });
    }

    // fist: select * from art_reward_activity where status=0 and action_tag=? order by id desc limit 1;
    // update art_reward_activity set own_address = ? where id = 1 and status=0 and action_tag=?
    // Obtain an art prize.
    async fetchArtReward(
        campaignTag: string,
        wonAddress: string,
        twitterUserId: string

    ): Promise<ArtRewardActivity | null> {
        const foundActivity = await this.prisma.artRewardActivity.findFirst({
            where: {
                status: RewardActivityStatus.INIT,
                campaignTag: campaignTag,
            },
            orderBy: {
                id: "desc",
            },
        });

        if (!foundActivity) {
            throw new Error(
                `Activity not found for status: ${RewardActivityStatus.INIT} and action_tag: ${campaignTag}`
            );
        }
        return this.prisma.artRewardActivity.update({
            where: {
                id: foundActivity.id,
                status: RewardActivityStatus.INIT,
                campaignTag: campaignTag,
            },
            data: {
                status: RewardActivityStatus.WON,
                wonAddress: wonAddress,
                twitterUserId: twitterUserId,
                updatedAt: new Date(),
            },
        });
    }

    async hasArtRewarded(
        campaignTag: string,
        twitterUserId: string
    ): Promise<ArtRewardActivity | null> {
        return this.prisma.artRewardActivity.findFirst({
            where: {
                twitterUserId: twitterUserId,
                campaignTag: campaignTag,
            },
        });
    }

    async getInitCount(campaignTag: string): Promise<number> {
        return this.prisma.artRewardActivity.count({
            where: {
                status: RewardActivityStatus.INIT,
                campaignTag: campaignTag,
            },
        });
    }

    // first: select id from art_reward_activity where status=1 or (status=4 and submitTimeOut<=current_time) order by id desc limit ?;
    // update art_reward_activity set status=2 where id = 1 and status=1 and campaign_tag=?
    async batchArtRewardActivity(
        syncBatchId: string,
        limit: number
    ): Promise<ArtRewardActivity[]> {
        return this.prisma.$transaction(async (tx) => {
            const recordsToUpdate = await tx.artRewardActivity.findMany({
                where: {
                    OR: [
                        { status: RewardActivityStatus.WON },
                        {
                            AND: [
                                { status: RewardActivityStatus.AWARDED_FAILED },
                                { submitTimeOut: { lte: new Date() } },
                            ],
                        },
                    ],
                },
                orderBy: { id: "asc" },
                take: limit,
                select: { id: true },
            });

            if (recordsToUpdate.length === 0) return [];

            const ids = recordsToUpdate.map((record) => record.id);

            // 更新符合条件的记录
            const { count } = await tx.artRewardActivity.updateMany({
                where: { id: { in: ids } },
                data: {
                    status: RewardActivityStatus.AWARDING,
                    submitTimeOut: new Date(Date.now() + 15 * 60 * 1000), // 当前时间 + 15 分钟
                    updatedAt: new Date(), // 设置为当前时间
                    submitBatchId: syncBatchId, // 设置 syncBatchId
                },
            });

            return count > 0
                ? tx.artRewardActivity.findMany({
                      where: { submitBatchId: syncBatchId },
                  })
                : [];
        });
    }

    //update the award status
    async updateArtAwardStatus(
        id: number,
        status: RewardActivityStatus,
        result: string
    ): Promise<ArtRewardActivity | null> {
        return this.prisma.artRewardActivity.update({
            where: {
                id: id,
            },
            data: {
                status: status,
                updatedAt: new Date(),
                submitResult: result,
            },
        });
    }
}
