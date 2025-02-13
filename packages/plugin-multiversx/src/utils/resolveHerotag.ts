import { elizaLogger } from "@elizaos/core";

export async function resolveHerotag(herotag: string): Promise<string | null> {
    if (!herotag || herotag.toLowerCase() === "null") {
        elizaLogger.error(
            "Invalid Herotag detected (null or empty). Aborting resolution."
        );
        return null;
    }

    try {
        const response = await fetch(
            `https://api.multiversx.com/usernames/${herotag}?withGuardianInfo=false`
        );
        if (!response.ok) throw new Error("Invalid Herotag response");

        const data = await response.json();
        if (!data.address) {
            elizaLogger.error(
                `Herotag "${herotag}" exists but does not resolve to an address.`
            );
            return null;
        }

        return data.address;
    } catch (error) {
        elizaLogger.error("Error resolving Herotag:", error);
        return null;
    }
}
