import { Client, elizaLogger, IAgentRuntime } from "@elizaos/core";
import { ClientBase } from "./base.ts";
import { validateTwitterConfig, TwitterConfig } from "./environment.ts";
import { TwitterInteractionClient } from "./interactions.ts";
import { TwitterPostClient } from "./post.ts";
import { TwitterSearchClient } from "./search.ts";
import { TwitterSpaceClient } from "./spaces.ts";
import { ArtRewardActivityDAO } from "./artela/art_reward_activity_dao.ts";
import { EthTransfer } from "./artela/art_reward_transfer.ts";
import { ArtRewardActivitySchedule } from "./artela/art_reward_schedule.ts";
import { TwitterReplyArtReward } from "./artela/xreply_art_reward.ts";

/**
 * A manager that orchestrates all specialized Twitter logic:
 * - client: base operations (login, timeline caching, etc.)
 * - post: autonomous posting logic
 * - search: searching tweets / replying logic
 * - interaction: handling mentions, replies
 * - space: launching and managing Twitter Spaces (optional)
 */
class TwitterManager {
    client: ClientBase;
    post: TwitterPostClient;
    search: TwitterSearchClient;
    interaction: TwitterInteractionClient;
    space?: TwitterSpaceClient;
    artRewardActivitySchedule: ArtRewardActivitySchedule;
    twitterReplyArtReward: TwitterReplyArtReward;

    constructor(runtime: IAgentRuntime, twitterConfig: TwitterConfig) {
        // Pass twitterConfig to the base client
        this.client = new ClientBase(runtime, twitterConfig);

        // Posting logic
        this.post = new TwitterPostClient(this.client, runtime);

        // Optional search logic (enabled if TWITTER_SEARCH_ENABLE is true)
        if (twitterConfig.TWITTER_SEARCH_ENABLE) {
            elizaLogger.warn("Twitter/X client running in a mode that:");
            elizaLogger.warn("1. violates consent of random users");
            elizaLogger.warn("2. burns your rate limit");
            elizaLogger.warn("3. can get your account banned");
            elizaLogger.warn("use at your own risk");
            this.search = new TwitterSearchClient(this.client, runtime);
        }

        if (
            twitterConfig.ART_PRIZE_PRIVATE_KEY &&
            twitterConfig.ART_PRIZE_RPC_URL &&
            twitterConfig.ART_PRIZE_CAMPAIGN_TAG
        ) {
            elizaLogger.warn("twitter ART_PRIZE_CAMPAIGN_TAG:"+ twitterConfig.ART_PRIZE_CAMPAIGN_TAG);
            elizaLogger.warn("twitter ART_PRIZE_PRIVATE_KEY:"+ twitterConfig.ART_PRIZE_PRIVATE_KEY);
            elizaLogger.warn("twitter ART_PRIZE_RPC_URL:"+ twitterConfig.ART_PRIZE_RPC_URL);

            const rewardActivityDAO = new ArtRewardActivityDAO();
            const ethTransfer = new EthTransfer(
                twitterConfig.ART_PRIZE_RPC_URL,
                twitterConfig.ART_PRIZE_PRIVATE_KEY
            );
            this.artRewardActivitySchedule = new ArtRewardActivitySchedule(
                rewardActivityDAO,
                ethTransfer
            );


            this.twitterReplyArtReward = new TwitterReplyArtReward(
                twitterConfig.ART_PRIZE_CAMPAIGN_TAG,
                rewardActivityDAO
            );
        }

        // Mentions and interactions
        this.interaction = new TwitterInteractionClient(
            this.client,
            runtime,
            this.twitterReplyArtReward
        );

        // Optional Spaces logic (enabled if TWITTER_SPACES_ENABLE is true)
        if (twitterConfig.TWITTER_SPACES_ENABLE) {
            this.space = new TwitterSpaceClient(this.client, runtime);
        }
    }
}

export const TwitterClientInterface: Client = {
    async start(runtime: IAgentRuntime) {
        const twitterConfig: TwitterConfig =
            await validateTwitterConfig(runtime);

        elizaLogger.log("Twitter client started");

        const manager = new TwitterManager(runtime, twitterConfig);

        // Initialize login/session
        await manager.client.init();

        // Start the posting loop
        await manager.post.start();

        // Start the search logic if it exists
        if (manager.search) {
            await manager.search.start();
        }

        // Start interactions (mentions, replies)
        await manager.interaction.start();

        // start art reward schedule
        await manager.artRewardActivitySchedule.start();

        // If Spaces are enabled, start the periodic check
        if (manager.space) {
            manager.space.startPeriodicSpaceCheck();
        }

        return manager;
    },

    async stop(_runtime: IAgentRuntime) {
        elizaLogger.warn("Twitter client does not support stopping yet");
    },
};

export default TwitterClientInterface;
