import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import { elizaLogger } from "@elizaos/core";

export class Store {
    db: DatabaseType;

    constructor(dbPath: string = "../xscores.db") {
        this.db = new Database(dbPath);
        this.ensureDatabaseInitialized();
    }

    /**
     * Ensures the database and table are initialized.
     */
    private ensureDatabaseInitialized(): void {
        const tableName = "scores";
        if (!this.tableExists(tableName)) {
            elizaLogger.log(
                `Table '${tableName}' does not exist. Initializing...`
            );
            this.initializeDatabase();
            elizaLogger.log(
                `Table '${tableName}' has been successfully created.`
            );
        }
    }

    /**
     * Checks if a table exists in the database.
     * @param tableName Name of the table to check.
     * @returns True if the table exists, false otherwise.
     */
    private tableExists(tableName: string): boolean {
        const result = this.db
            .prepare(
                `SELECT name
                 FROM sqlite_master
                 WHERE type = 'table' AND name = ?;`
            )
            .get(tableName);
        return result !== undefined;
    }

    /**
     * Initializes the database by creating the necessary table and indices.
     */
    private initializeDatabase(): void {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS scores (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                original_tweet_time TEXT NOT NULL,
                aivinci_reply_time  TEXT NOT NULL,
                original_tweet_url  TEXT NOT NULL,
                aivinci_score_tweet TEXT NOT NULL,
                score               REAL NOT NULL
            );
        `);

        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_original_tweet_time ON scores (original_tweet_time);
            CREATE INDEX IF NOT EXISTS idx_aivinci_reply_time ON scores (aivinci_reply_time);
            CREATE INDEX IF NOT EXISTS idx_original_tweet_url ON scores (original_tweet_url);
            CREATE INDEX IF NOT EXISTS idx_aivinci_score_tweet ON scores (aivinci_score_tweet);
            CREATE INDEX IF NOT EXISTS idx_score ON scores (score);
        `);
    }

    /**
     * Stores a tweet's data in the database.
     * @param originalTweetTime Original tweet timestamp.
     * @param aivinciReplyTime Reply tweet timestamp.
     * @param originalTweetUrl Original tweet URL.
     * @param aivinciScoreTweet Score-related tweet content.
     */
    storeTweet(
        originalTweetTime: string,
        aivinciReplyTime: string,
        originalTweetUrl: string,
        aivinciScoreTweet: string
    ): void {
        const score = this.extractSingleScore(aivinciScoreTweet) || 0;

        try {
            this.db
                .prepare(
                    `INSERT INTO scores
                     (original_tweet_time, aivinci_reply_time, original_tweet_url, aivinci_score_tweet, score)
                     VALUES (?, ?, ?, ?, ?)`
                )
                .run(
                    originalTweetTime,
                    aivinciReplyTime,
                    originalTweetUrl,
                    aivinciScoreTweet,
                    score
                );
        } catch (error) {
            elizaLogger.error(
                `Failed to store tweet data.`,
                {
                    originalTweetTime,
                    aivinciReplyTime,
                    originalTweetUrl,
                    aivinciScoreTweet,
                    score,
                },
                error
            );
        }
    }

    /**
     * Extracts a score from the given text based on specific keywords.
     * @param text The text containing potential scores.
     * @returns Extracted score or null if none found.
     */
    private extractSingleScore(text: string): number | null {
        const ratingKeywords = ["score", "rating", "relevance", "rate"];
        const regex = /\b([1-9][0-9]?)\b/g; // Matches numbers between 1 and 99
        const sentences = text.split(/[.,!?;]\s*/);

        let fallbackScore: number | null = null;

        for (const sentence of sentences) {
            const matches = Array.from(sentence.matchAll(regex)).map((match) =>
                Number(match[0])
            );
            if (matches.length === 0) continue;

            // Prioritize matches containing keywords
            if (ratingKeywords.some((keyword) => sentence.includes(keyword))) {
                return matches[0];
            }

            // Default to the first match if no keywords are found
            if (fallbackScore === null) {
                fallbackScore = matches[0];
            }
        }

        return fallbackScore;
    }
}
