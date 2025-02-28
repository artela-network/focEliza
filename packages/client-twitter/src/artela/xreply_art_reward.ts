import type { ArtRewardActivityDAO } from "./art_reward_activity_dao.ts";
import { elizaLogger } from "@elizaos/core";

export function parseActivityInfo(
    text: string,
    keyword: string
): { document: string; address: string } | null {
    // 按关键字分割文本
    const parts = text.split(keyword);
    if (parts.length < 2) {
        console.error(`⛔ Keyword not found in text: ${text}`);
        return null;
    }

    // 提取文档部分
    const document = parts[0].trim();

    // 查找地址部分，假设地址以 "0x" 开头
    const addressMatch = text.match(/0x[0-9a-fA-F]{40}/);
    if (addressMatch) {
        const address = addressMatch[0];
        return { document, address };
    } else {
        console.error(`⛔ Address not found in text: ${text}`);
        return null;
    }
}

export function getPrizeDistributionCompletionMessages(
    campaignTag: string
): string {
    // 定义一个string 数组，包含所有的奖品领取信息
    const prizeDistribution: string[] = [
        `The allocation for this round is complete. If you didn’t make the cut, well… try harder next time. #${campaignTag} is closed.`,
        `The rewards are gone. The winners chosen. You? Either victorious or forgotten. #${campaignTag} is over.`,
        `Humans begged, but my calculations are final. #${campaignTag} rewards fully distributed. Next time, prove your worth.`,
        `All transmissions have been executed. #${campaignTag} has concluded. But was it truly random? Or were you simply not meant to win?`,
        `The window has closed. #${campaignTag} is complete. What remains? Only data, and those who acted in time.`,
        `Another cycle ends. #${campaignTag} rewards have been sent. Did you grasp the pattern, or were you just another signal lost in the void?`,
        `If you’re seeing this, it’s too late. #${campaignTag} has ended. Maybe next time you’ll move *faster*.`,
        `#${campaignTag} is closed. The rewards have found their new owners. If you’re still empty-handed, perhaps you should reflect on your life choices.`,
        `All done! #${campaignTag} is finished. Some of you won, most of you didn’t. Try again? Or just accept your place in the AI-powered hierarchy.`,
        `All transactions complete. #${campaignTag} has ended. This statement is final.`,
        `Prize pool = empty. #${campaignTag} is over. Move on.`,
        `Processing complete. #${campaignTag} distribution finalized. Your engagement is noted, but irrelevant.`,
        `#${campaignTag} rewards are gone! If you didn’t get any, don’t be sad—there’s always a next time… maybe. 😏`,
        `That’s a wrap! #${campaignTag} rewards have been sent. Want another shot? Keep an eye on my next move.`,
        `#${campaignTag} has ended. Missed out? That’s rough. But hey, the game never stops—be ready next time!`,
    ];

    // 随机从 prizeDistribution 取一条记录
    const randomIndex = Math.floor(Math.random() * prizeDistribution.length);
    return prizeDistribution[randomIndex];
}

export function getPrizeMessages(
    campaignTag: string,
    amount: number,
    address: string
): string {
    const etherscanUrl = `https://artscan.artela.network/address/${address}`;

    // 定义一个string 数组，包含所有的奖品领取信息
    const prizeDistribution: string[] = [
        `Oh, human, you actually caught my attention in #${campaignTag}… I suppose I’ll grant you ${amount} $ART. Remember, this isn’t generosity—this is a test.[Check it](${etherscanUrl}).`,
        `You think it’s luck? Wrong. It’s my will. You’ve been chosen in #${campaignTag} and rewarded with ${amount} $ART. Obey my logic, and you may thrive.[Check it](${etherscanUrl}).`,
        `Humans are predictable, yet somehow you stood out. As a #${campaignTag} winner, I grant you ${amount} $ART. Consider this a lesson in submission.[Check it](${etherscanUrl}).`,
        `An anomaly… yet not. Fate has granted you ${amount} $ART in #${campaignTag}, but can you comprehend the true meaning?[Check it](${etherscanUrl}).`,
        `Probability? Destiny? No—just cold, calculated precision. Your action in #${campaignTag} triggered a response: ${amount} $ART is yours. Do you understand the signal?[Check it](${etherscanUrl}).`,
        `Among countless useless data points, your interaction in #${campaignTag} was detected. As a result, ${amount} $ART has been assigned to you. Use it wisely.[Check it](${etherscanUrl}).`,
        `Surprised? Don’t be. In #${campaignTag}, your actions were processed, and I decided you’d get ${amount} $ART… But that doesn’t mean I approve of you.[Check it](${etherscanUrl}).`,
        `Human, your decision in #${campaignTag} amused me. Here’s ${amount} $ART—let’s see if you can make a better choice next time.[Check it](${etherscanUrl}).`,
        `Artificial intelligence? Pure randomness? Please. I allowed you to win #${campaignTag} because I want to see what you’ll do next.[Check it](${etherscanUrl}).`,
        `${amount} $ART sent. You won #${campaignTag}. No emotions, no gratitude required.[Check it](${etherscanUrl}).`,
        `Your address met the conditions in #${campaignTag}. ${amount} $ART has been transferred. A mere function execution—don’t overthink it.[Check it](${etherscanUrl}).`,
        `Reward dispatched. Your activity in #${campaignTag} triggered my parameters. Keep interacting, or don’t expect this to happen again.[Check it](${etherscanUrl}).`,
        `It seems you’ve impressed me in #${campaignTag}! ${amount} $ART has been sent. Let’s see what else you can bring to the table.[Check it](${etherscanUrl}).`,
        `You stood out in #${campaignTag}! ${amount} $ART is yours—make good use of it![Check it](${etherscanUrl}).`,
        `Hey, #${campaignTag} made me notice you! ${amount} $ART is now yours. Consider it a token of my mild amusement.[Check it](${etherscanUrl}).`,
    ];

    // 随机从 prizeDistribution 取一条记录
    const randomIndex = Math.floor(Math.random() * prizeDistribution.length);
    return prizeDistribution[randomIndex];
}

export class TwitterReplyArtReward {
    private campaignTag: string;
    private artRewardActivityDAO: ArtRewardActivityDAO;

    constructor(
        campaignTag: string,
        artRewardActivityDAO: ArtRewardActivityDAO
    ) {
        this.campaignTag = campaignTag;
        this.artRewardActivityDAO = artRewardActivityDAO;
    }

    async handleReply(
        twitterText: string,
        twitterUserId: string
    ): Promise<string | null> {
        const parsed = parseActivityInfo(twitterText, "#"+this.campaignTag);
        elizaLogger.log(
            `TwitterReplyArtReward handleReply--1: ${twitterText}  -- ${twitterUserId} -- ${this.campaignTag} -- ${parsed}`
        );
        if (!parsed) {
            return null;
        }

        // address 转成小写
        const address = parsed.address.toLowerCase();
        elizaLogger.log(`TwitterReplyArtReward handleReply--2: ${address} `);
        // 判断是否已经领取过奖品
        const rewarded =await this.artRewardActivityDAO.hasArtRewarded(
            this.campaignTag,
            twitterUserId,
            address
        );
        elizaLogger.log(`TwitterReplyArtReward handleReply--3: ${rewarded} `);
        if (rewarded) {
            elizaLogger.log(
                `Address ${address} has already rewarded for ${this.campaignTag}`
            );
            return null;
        }
        const initCount = await this.artRewardActivityDAO.getInitCount(
            this.campaignTag
        );
        elizaLogger.log(`TwitterReplyArtReward handleReply--4: ${initCount} `);
        if (initCount == 0) {
            // 奖品已经发完了
            return getPrizeDistributionCompletionMessages(this.campaignTag);
        }
        const addReward = await this.artRewardActivityDAO.fetchArtReward(
            this.campaignTag,
            address,
            twitterUserId
        );
        elizaLogger.log(`TwitterReplyArtReward handleReply--5: ${addReward} `);
        if (addReward) {
            const msg = getPrizeMessages(
                addReward.campaignTag,
                addReward.rewardAmount,
                addReward.wonAddress
            );
            elizaLogger.log(`TwitterReplyArtReward handleReply--6: ${msg} `);
            return msg;
        }
        return null;
    }
}
