import {
    elizaLogger,
    type ActionExample,
    type Content,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    ModelClass,
    type State,
    composeContext,
    generateObject,
    type Action,
} from "@elizaos/core";
import { WalletProvider } from "../providers/wallet";
import { GraphqlProvider } from "../providers/graphql";
import { validateMultiversxConfig } from "../environment";
import { poolSchema } from "../utils/schemas";
import { MVX_NETWORK_CONFIG } from "../constants";
import { denominateAmount, getRawAmount } from "../utils/amount";
import {
    createPairQuery,
    createPoolCreatePoolTokenQuery,
    createPoolSetLocalRolesQuery,
    createPoolFilterWithoutLpQuery,
    createPoolSetInitialExchangeRateQuery,
    lockTokensQuery,
    createPoolUserLpsQuery,
    setSwapEnabledByUserQuery,
    wrapEgldQuery,
} from "../graphql/createLiquidityPoolQueries";
import { NativeAuthProvider } from "../providers/nativeAuth";
import { isUserAuthorized } from "../utils/accessTokenManagement";
import {
    FungibleTokenOfAccountOnNetwork,
    Transaction,
    TransactionPayload,
} from "@multiversx/sdk-core/out";
import { TransactionWatcher, ApiNetworkProvider } from "@multiversx/sdk-core";
export interface ICreatePoolContent extends Content {
    baseTokenID: string;
    quoteTokenID: string;
    baseAmount: string;
    quoteAmount: string;
}

const debugModeOn = true;

const poolTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
    "baseTokenID": "KWAK",
    "quoteTokenID": "EGLD",
    "baseAmount": "1000000",
    "quoteAmount": "20"
}
\`\`\`

{{recentMessages}}

Given the recent messages, extract the following information about the requested pair creation:
- Token A
- Token B
- Amount Token A
- Amount Token B

Respond with a JSON markdown block containing only the extracted values.`;

export default {
    name: "CREATE_POOL",
    similes: ["CREATE_PAIR", "CREATE_TOKEN_PAIR", "CREATE_LP"],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        elizaLogger.log("Validating config for user:", message.userId);
        await validateMultiversxConfig(runtime);
        return true;
    },
    description: "Create a liquidity pool of tokens",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ) => {
        elizaLogger.log("Starting CREATE_POOL handler...");

        // Check user authorization
        if (!isUserAuthorized(message.userId, runtime)) {
            elizaLogger.error(
                "Unauthorized user attempted to create a liquidity pool:",
                message.userId
            );
            if (callback) {
                callback({
                    text: "You do not have permission to create a liquidity pool.",
                    content: { error: "Unauthorized user" },
                });
            }
            return false;
        }

        // Compose or update state
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        // Handling errors
        function extractErrorMessage(error: any): string {
            return error.response &&
                error.response.errors &&
                error.response.errors.length > 0
                ? error.response.errors[0].message
                : error.message;
        }

        // Generate pool context
        const poolContext = composeContext({
            state,
            template: poolTemplate,
        });

        const content = await generateObject({
            runtime,
            context: poolContext,
            modelClass: ModelClass.SMALL,
            schema: poolSchema,
        });

        const poolContent = content.object as ICreatePoolContent;

        // Validate pool content
        if (
            !poolContent.baseTokenID ||
            !poolContent.quoteTokenID ||
            !poolContent.baseAmount ||
            !poolContent.quoteAmount ||
            typeof poolContent.baseTokenID !== "string" ||
            typeof poolContent.quoteTokenID !== "string" ||
            typeof poolContent.baseAmount !== "string" ||
            typeof poolContent.quoteAmount !== "string"
        ) {
            elizaLogger.error("Invalid content for CREATE_POOL action.");

            callback?.({
                text: "Unable to process liquidity pool creation request. Invalid content provided.",
                content: { error: "Invalid liquidity pool content" },
            });

            return false;
        }

        try {
            // Retrieve settings and initialize providers
            const privateKey = runtime.getSetting("MVX_PRIVATE_KEY");
            const network = runtime.getSetting("MVX_NETWORK");
            const networkConfig = MVX_NETWORK_CONFIG[network];

            const walletProvider = new WalletProvider(privateKey, network);

            const apiNetworkProvider = new ApiNetworkProvider(
                networkConfig.apiURL,
                {
                    clientName: "ElizaOs",
                }
            );

            const config = {
                origin: networkConfig.xExchangeOriginURL,
                apiUrl: networkConfig.apiURL,
            };

            const nativeAuthProvider = new NativeAuthProvider(config);
            await nativeAuthProvider.initializeClient();

            const accessToken =
                await nativeAuthProvider.getAccessToken(walletProvider);

            if (debugModeOn) {
                elizaLogger.log(
                    "Native Auth Access Token generated:",
                    accessToken
                );
            }

            const graphqlProvider = new GraphqlProvider(
                networkConfig.graphURL,
                { Authorization: `Bearer ${accessToken}` }
            );

            function normalizeIdentifier(identifier: string): string {
                return identifier.split("-")[0].toUpperCase();
            }

            async function findTokenIdentifier(
                ticker: string
            ): Promise<string | null> {
                try {
                    const tokenData = await walletProvider.getTokensData();

                    const normalizedTicker = normalizeIdentifier(ticker);

                    const token = tokenData.find(
                        (token) =>
                            token.identifier &&
                            normalizeIdentifier(token.identifier) ===
                                normalizedTicker
                    );

                    if (token) {
                        return token.identifier;
                    } else {
                        elizaLogger.error(
                            "Identifier not found for ticker:",
                            ticker
                        );
                        return null;
                    }
                } catch (error) {
                    elizaLogger.error("Error finding token identifier:", error);
                    return null;
                }
            }

            async function findTokenBalance(
                ticker: string
            ): Promise<string | null> {
                try {
                    const tokenData = await walletProvider.getTokensData();

                    const normalizedTicker = normalizeIdentifier(ticker);

                    const token = tokenData.find(
                        (token) =>
                            token.identifier &&
                            normalizeIdentifier(token.identifier) ===
                                normalizedTicker
                    );

                    if (token) {
                        return token.balance.toString();
                    } else {
                        elizaLogger.error(
                            "Balance not found for ticker:",
                            ticker
                        );
                        return null;
                    }
                } catch (error) {
                    this.elizaLogger.error(
                        "Error finding token balance:",
                        error
                    );
                    return null;
                }
            }

            const isBaseEGLD = poolContent.baseTokenID.toLowerCase() === "egld";
            const isQuoteEGLD =
                poolContent.quoteTokenID.toLowerCase() === "egld";

            if (!isBaseEGLD && !isQuoteEGLD) {
                throw new Error("❌ One of the tokens must be EGLD.");
            }

            // Ensure quoteToken is EGLD
            let baseToken = poolContent.baseTokenID;
            let quoteToken = poolContent.quoteTokenID;
            let baseAmount = poolContent.baseAmount;
            let quoteAmount = poolContent.quoteAmount;

            if (isBaseEGLD) {
                [baseToken, quoteToken] = [quoteToken, baseToken]; // Swap tokens
                [baseAmount, quoteAmount] = [quoteAmount, baseAmount]; // Swap amount
            }

            const address = walletProvider.getAddress().toBech32();
            const quoteTokenIdentifier = networkConfig.wrappedEgldIdentifier;
            const baseTokenIdentifier = await findTokenIdentifier(baseToken);

            let tokenData: FungibleTokenOfAccountOnNetwork = null;
            let rawBalance;
            let rawBalanceNum;

            try {
                // Check token balance

                tokenData =
                    await walletProvider.getTokenData(baseTokenIdentifier);

                rawBalance = getRawAmount({
                    amount: tokenData.balance.toString(),
                    decimals: tokenData.rawResponse.decimals,
                });

                rawBalanceNum = Number(rawBalance);

                if (rawBalanceNum < Number(baseAmount)) {
                    throw new Error(
                        `❌ Insufficient ${baseTokenIdentifier} balance`
                    );
                }

                // Check WEGLD balance

                try {
                    tokenData =
                        await walletProvider.getTokenData(quoteTokenIdentifier);

                    rawBalanceNum = getRawAmount({
                        amount: tokenData.balance.toString(),
                        decimals: tokenData.rawResponse.decimals,
                    });

                    rawBalanceNum = Number(rawBalanceNum);
                } catch (error) {
                    if (
                        error.message.includes(
                            "Token for given account not found"
                        )
                    ) {
                        elizaLogger.warn(
                            `Token ${quoteTokenIdentifier} not found, assuming balance = 0`
                        );
                        rawBalanceNum = 0;
                    } else {
                        throw error;
                    }
                }

                if (rawBalanceNum < Number(quoteAmount)) {
                    elizaLogger.log(
                        "❌ Insufficient Wrapped EGLD balance. Checking EGLD..."
                    );

                    // Check EGLD balance before wrapping

                    const missingAmount = String(Number(quoteAmount) - rawBalanceNum);

                    const hasEgldBalance =
                        await walletProvider.hasEgldBalance(missingAmount);
                    if (!hasEgldBalance) {
                        throw new Error("❌ Insufficient EGLD balance.");
                    }

                    const rawAmountToWrap = Number(missingAmount) * 10 ** 18;

                    if (debugModeOn) {
                        elizaLogger.log("🔵 Sending GraphQL request:");
                        elizaLogger.log("Query:", wrapEgldQuery);
                        elizaLogger.log(
                            "Variables:",
                            JSON.stringify(
                                { wrappingAmount: String(rawAmountToWrap) },
                                null,
                                2
                            )
                        );
                    }

                    const wrapEgldresponse = await graphqlProvider.query<any>(
                        wrapEgldQuery,
                        {
                            wrappingAmount: String(rawAmountToWrap),
                        }
                    );

                    if (debugModeOn) {
                        elizaLogger.log("🟢 Received GraphQL response:");
                        elizaLogger.log(
                            JSON.stringify(wrapEgldresponse, null, 2)
                        );
                    }

                    if (!wrapEgldresponse) {
                        throw new Error(
                            "❌ Wrapping EGLD failed. No response from GraphQL."
                        );
                    }

                    if (wrapEgldresponse.errors) {
                        elizaLogger.error(
                            "❌ GraphQL Errors:",
                            JSON.stringify(wrapEgldresponse.errors, null, 2)
                        );
                        throw new Error("❌ GraphQL returned errors.");
                    }

                    const wrapEgld = wrapEgldresponse.wrapEgld;

                    if (!wrapEgld) {
                        throw new Error(
                            "❌ Wrapping EGLD failed. Missing wrapEgld in response."
                        );
                    }

                    // Prepare and send the transaction
                    const wrapEgldTxToBroadcast = {
                        sender: address,
                        value: wrapEgld.value,
                        data: TransactionPayload.fromEncoded(wrapEgld.data),
                        nonce: await walletProvider
                            .getAccount(walletProvider.getAddress())
                            .then((account) => account.nonce),
                        gasLimit: wrapEgld.gasLimit,
                        receiver: wrapEgld.receiver,
                        chainID: wrapEgld.chainID,
                    };

                    const wrapEgldTx = new Transaction(wrapEgldTxToBroadcast);
                    const wrapEgldsignature =
                        await walletProvider.signTransaction(wrapEgldTx);
                    wrapEgldTx.applySignature(wrapEgldsignature);

                    const wrapEgldTxHash =
                        await walletProvider.sendTransaction(wrapEgldTx);
                    const wrapEgldTxURL =
                        walletProvider.getTransactionURL(wrapEgldTxHash);

                    if (debugModeOn) {
                        elizaLogger.log(
                            "wrapEgld transaction sent successfully"
                        );
                        elizaLogger.log(`Transaction URL: ${wrapEgldTxURL}`);
                    }

                    const wrapEgldWatcher = new TransactionWatcher(
                        apiNetworkProvider
                    );
                    const wrapEgldTransactionOnNetwork =
                        await wrapEgldWatcher.awaitCompleted(wrapEgldTx);

                    if (
                        "status" in wrapEgldTransactionOnNetwork.status &&
                        wrapEgldTransactionOnNetwork.status.status === "success"
                    ) {
                        if (debugModeOn) {
                            elizaLogger.log("wrapEgld transaction success.");
                        }
                        callback?.({
                            text: `EGLD wrapped successfully, creating pair..`,
                        });
                    } else {
                        throw new Error("❌ wrapEgld transaction failed.");
                    }
                }
            } catch (error) {
                const errMsg = extractErrorMessage(error);
                elizaLogger.error(
                    "❌ Error during liquidity pool creation:",
                    errMsg
                );

                callback?.({
                    text: `An error occurred while creating the liquidity pool: ${errMsg}`,
                });

                return false;
            }

            // Step 1: Create Pair

            try {
                const createPairVariables = {
                    firstTokenID: baseTokenIdentifier,
                    secondTokenID: quoteTokenIdentifier,
                };

                if (debugModeOn) {
                    elizaLogger.log("🔵 Sending GraphQL request:");
                    elizaLogger.log("Query:", createPairQuery);
                    elizaLogger.log(
                        "Variables:",
                        JSON.stringify(createPairVariables, null, 2)
                    );
                }

                const { createPair } = await graphqlProvider.query<any>(
                    createPairQuery,
                    createPairVariables
                );

                if (debugModeOn) {
                    elizaLogger.log("🟢 Received GraphQL response:");
                    elizaLogger.log(JSON.stringify(createPair, null, 2));
                }

                if (!createPair) {
                    throw new Error(
                        "❌ Pair creation failed. No response from GraphQL."
                    );
                }

                // Prepare and send the transaction
                const createPairTxToBroadcast = {
                    sender: address,
                    data: TransactionPayload.fromEncoded(createPair.data),
                    nonce: await walletProvider
                        .getAccount(walletProvider.getAddress())
                        .then((account) => account.nonce),
                    gasLimit: createPair.gasLimit,
                    receiver: createPair.receiver,
                    chainID: createPair.chainID,
                };

                const createPairTx = new Transaction(createPairTxToBroadcast);
                const createPairsignature =
                    await walletProvider.signTransaction(createPairTx);
                createPairTx.applySignature(createPairsignature);

                const createPairTxHash =
                    await walletProvider.sendTransaction(createPairTx);
                const createPairTxURL =
                    walletProvider.getTransactionURL(createPairTxHash);

                if (debugModeOn) {
                    elizaLogger.log("Step 1/6: createPair");
                    elizaLogger.log("createPair transaction sent successfully");
                    elizaLogger.log(`Transaction URL: ${createPairTxURL}`);
                }

                const createPairWatcher = new TransactionWatcher(
                    apiNetworkProvider
                );
                const createPairTransactionOnNetwork =
                    await createPairWatcher.awaitCompleted(createPairTx);

                if (
                    "status" in createPairTransactionOnNetwork.status &&
                    createPairTransactionOnNetwork.status.status === "success"
                ) {
                    if (debugModeOn) {
                        elizaLogger.log(
                            "createPair transaction success, issuing LP Token.."
                        );
                    }
                    callback?.({
                        text: `Step 1/6: Pair created successfully, issuing LP Token..`,
                    });
                } else {
                    throw new Error("❌ createPair transaction failed.");
                }
            } catch (error) {
                const errMsg = extractErrorMessage(error);
                elizaLogger.error(
                    "❌ Error during liquidity pool creation:",
                    errMsg
                );

                callback?.({
                    text: `An error occurred while creating the liquidity pool: ${errMsg}`,
                });

                return false;
            }

            // Step 2: Issue LP Token

            // Create LP Token name and ticker
            const baseTokenSymbol = baseTokenIdentifier.split("-")[0];
            const quoteTokenSymbol = quoteTokenIdentifier.split("-")[0];
            const lpTokenName = `${baseTokenSymbol}${quoteTokenSymbol}LP`;
            const truncatedBaseTokenSymbol = baseTokenSymbol.slice(0, 5);
            const lpTokenTicker = `${truncatedBaseTokenSymbol}${quoteTokenSymbol}`;

            let scAddress;

            try {
                if (debugModeOn) {
                    elizaLogger.log("🔵 Sending first GraphQL request:");
                    elizaLogger.log("Query:", createPoolFilterWithoutLpQuery);
                    elizaLogger.log(
                        "Variables:",
                        JSON.stringify(
                            {
                                firstTokenID: baseTokenIdentifier,
                                secondTokenID: quoteTokenIdentifier,
                            },
                            null,
                            2
                        )
                    );
                }

                const issueLPTokenResponse = await graphqlProvider.query<any>(
                    createPoolFilterWithoutLpQuery,
                    {
                        firstTokenID: baseTokenIdentifier,
                        secondTokenID: quoteTokenIdentifier,
                    }
                );
                if (debugModeOn) {
                    elizaLogger.log("🟢 Received GraphQL response:");
                    elizaLogger.log(
                        JSON.stringify(issueLPTokenResponse, null, 2)
                    );
                }

                if (
                    !issueLPTokenResponse ||
                    !issueLPTokenResponse.filteredPairs
                ) {
                    throw new Error("❌ No data returned from GraphQL.");
                }

                const createPoolFilterWithoutLp =
                    issueLPTokenResponse.filteredPairs;

                scAddress =
                    createPoolFilterWithoutLp.edges?.[0]?.node?.address || null;

                if (!scAddress) {
                    throw new Error("❌ scAddress not found.");
                }

                if (debugModeOn) {
                    elizaLogger.log("🔵 Sending second GraphQL request:");
                    elizaLogger.log("Query:", createPoolCreatePoolTokenQuery);
                    elizaLogger.log(
                        "Variables:",
                        JSON.stringify(
                            {
                                lpTokenName: lpTokenName,
                                lpTokenTicker: lpTokenTicker,
                                address: scAddress,
                            },
                            null,
                            2
                        )
                    );
                }

                const { issueLPToken } = await graphqlProvider.query<any>(
                    createPoolCreatePoolTokenQuery,
                    {
                        lpTokenName: lpTokenName,
                        lpTokenTicker: lpTokenTicker,
                        address: scAddress,
                    }
                );

                if (debugModeOn) {
                    elizaLogger.log("🟢 Received GraphQL response:");
                    elizaLogger.log(JSON.stringify(issueLPToken, null, 2));
                }

                if (!issueLPToken) {
                    throw new Error(
                        "❌ LP Token creation failed. No response from GraphQL."
                    );
                }

                // Prepare and send the transaction
                const issueLPTokenBroadcast = {
                    sender: address,
                    receiver: issueLPToken.receiver,
                    data: TransactionPayload.fromEncoded(issueLPToken.data),
                    value: 50000000000000000,
                    nonce: await walletProvider
                        .getAccount(walletProvider.getAddress())
                        .then((account) => account.nonce),
                    gasLimit: issueLPToken.gasLimit,
                    chainID: issueLPToken.chainID,
                };

                const issueLPTokenTx = new Transaction(issueLPTokenBroadcast);
                const issueLPTokenSignature =
                    await walletProvider.signTransaction(issueLPTokenTx);
                issueLPTokenTx.applySignature(issueLPTokenSignature);

                const issueLPTokenTxHash =
                    await walletProvider.sendTransaction(issueLPTokenTx);
                const issueLPTokenTxURL =
                    walletProvider.getTransactionURL(issueLPTokenTxHash);

                if (debugModeOn) {
                    elizaLogger.log("Step 2/6: issueLpToken");
                    elizaLogger.log(
                        "issueLpToken transaction sent successfully"
                    );
                    elizaLogger.log(`Transaction URL: ${issueLPTokenTxURL}`);
                }

                const issueLPTokenWatcher = new TransactionWatcher(
                    apiNetworkProvider
                );
                const issueLPTokenTransactionOnNetwork =
                    await issueLPTokenWatcher.awaitCompleted(issueLPTokenTx);

                if (
                    "status" in issueLPTokenTransactionOnNetwork.status &&
                    issueLPTokenTransactionOnNetwork.status.status === "success"
                ) {
                    if (debugModeOn) {
                        elizaLogger.log(
                            "issueLpToken transaction success, setting Local Roles.."
                        );
                    }
                    callback?.({
                        text: `Step 2/6: LP Token issued successfully, setting Local Roles..`,
                    });
                } else {
                    throw new Error("❌ issueLpToken transaction failed.");
                }
            } catch (error) {
                const errMsg = extractErrorMessage(error);
                elizaLogger.error(
                    "❌ Error during liquidity pool creation:",
                    errMsg
                );

                callback?.({
                    text: `An error occurred while creating the liquidity pool: ${errMsg}`,
                });

                return false;
            }

            // Step 3: Set Local Roles

            try {
                if (debugModeOn) {
                    elizaLogger.log("🔵 Sending GraphQL request:");
                    elizaLogger.log("Query:", createPoolSetLocalRolesQuery);
                    elizaLogger.log(
                        "Variables:",
                        JSON.stringify({ address: scAddress }, null, 2)
                    );
                }

                const { setLocalRoles } = await graphqlProvider.query<any>(
                    createPoolSetLocalRolesQuery,
                    {
                        address: scAddress,
                    }
                );
                if (debugModeOn) {
                    elizaLogger.log("🟢 Received GraphQL response:");
                    elizaLogger.log(JSON.stringify(setLocalRoles, null, 2));
                }

                if (!setLocalRoles) {
                    throw new Error(
                        "❌ Local roles setting failed. No response from GraphQL."
                    );
                }

                // Prepare and send the transaction
                const setLocalRolesBroadcast = {
                    sender: address,
                    receiver: setLocalRoles.receiver,
                    data: TransactionPayload.fromEncoded(setLocalRoles.data),
                    nonce: await walletProvider
                        .getAccount(walletProvider.getAddress())
                        .then((account) => account.nonce),
                    gasLimit: setLocalRoles.gasLimit,
                    chainID: setLocalRoles.chainID,
                };

                const setLocalRolesTx = new Transaction(setLocalRolesBroadcast);
                const setLocalRolesSignature =
                    await walletProvider.signTransaction(setLocalRolesTx);
                setLocalRolesTx.applySignature(setLocalRolesSignature);

                const setLocalRolesTxHash =
                    await walletProvider.sendTransaction(setLocalRolesTx);
                const setLocalRolesTxURL =
                    walletProvider.getTransactionURL(setLocalRolesTxHash);

                if (debugModeOn) {
                    elizaLogger.log("Step 3/6: setLocalRoles");
                    elizaLogger.log(
                        "setLocalRoles transaction sent successfully"
                    );
                    elizaLogger.log(`Transaction URL: ${setLocalRolesTxURL}`);
                }

                const setLocalRolesWatcher = new TransactionWatcher(
                    apiNetworkProvider
                );
                const setLocalRolesTransactionOnNetwork =
                    await setLocalRolesWatcher.awaitCompleted(setLocalRolesTx);

                if (
                    "status" in setLocalRolesTransactionOnNetwork.status &&
                    setLocalRolesTransactionOnNetwork.status.status ===
                        "success"
                ) {
                    if (debugModeOn) {
                        elizaLogger.log(
                            "setLocalRoles transaction success, adding initial liquidity.."
                        );
                    }
                    callback?.({
                        text: `Step 3/6: Local Roles set successfully, adding initial liquidity..`,
                    });
                } else {
                    throw new Error("❌ setLocalRoles transaction failed.");
                }
            } catch (error) {
                const errMsg = extractErrorMessage(error);
                elizaLogger.error(
                    "❌ Error during liquidity pool creation:",
                    errMsg
                );

                callback?.({
                    text: `An error occurred while creating the liquidity pool: ${errMsg}`,
                });

                return false;
            }

            // Step 4: Add initial liquididty

            try {
                const baseValue = denominateAmount({
                    amount: baseAmount,
                    decimals: tokenData?.rawResponse?.decimals,
                });

                const quoteValue = denominateAmount({
                    amount: quoteAmount,
                    decimals: 18,
                });

                const addInitialLiquidityVariables = {
                    pairAddress: scAddress,
                    tokens: [
                        {
                            tokenID: baseTokenIdentifier,
                            nonce: 0,
                            amount: baseValue.toString(),
                        },
                        {
                            tokenID: quoteTokenIdentifier,
                            nonce: 0,
                            amount: quoteValue.toString(),
                        },
                    ],
                    tolerance: 0.01,
                };
                if (debugModeOn) {
                    elizaLogger.log("🔵 Sending GraphQL request:");
                    elizaLogger.log(
                        "Query:",
                        createPoolSetInitialExchangeRateQuery
                    );
                    elizaLogger.log(
                        "Variables:",
                        JSON.stringify(addInitialLiquidityVariables, null, 2)
                    );
                }

                // Sending the GraphQL query with the defined variables
                const addInitialLiquidityResponse =
                    await graphqlProvider.query<any>(
                        createPoolSetInitialExchangeRateQuery,
                        addInitialLiquidityVariables
                    );
                if (debugModeOn) {
                    elizaLogger.log("🟢 Received GraphQL response:");
                    elizaLogger.log(
                        JSON.stringify(addInitialLiquidityResponse, null, 2)
                    );
                }

                // Check if the response contains a valid array 'addInitialLiquidityBatch'
                const addInitialLiquidityBatch =
                    addInitialLiquidityResponse.addInitialLiquidityBatch[0];

                if (debugModeOn) {
                    elizaLogger.log(
                        "addInitialLiquidityBatch:",
                        addInitialLiquidityBatch
                    );
                }

                // If the array is undefined, throw an error
                if (!addInitialLiquidityBatch) {
                    throw new Error(
                        "❌ No valid data returned in addInitialLiquidityBatch."
                    );
                }

                // Prepare and send the transaction
                let nonce;
                try {
                    const account = await walletProvider.getAccount(
                        walletProvider.getAddress()
                    );
                    nonce = account.nonce;
                } catch (error) {
                    throw new Error(
                        `❌ Failed to fetch nonce: ${error.message}`
                    );
                }

                const addInitialLiquidityBroadcast = {
                    sender: address,
                    receiver: addInitialLiquidityBatch.receiver,
                    data: TransactionPayload.fromEncoded(
                        addInitialLiquidityBatch.data
                    ),
                    nonce: nonce,
                    gasLimit: addInitialLiquidityBatch.gasLimit,
                    chainID: addInitialLiquidityBatch.chainID,
                };

                const addInitialLiquidityTx = new Transaction(
                    addInitialLiquidityBroadcast
                );
                const addInitialLiquiditySignature =
                    await walletProvider.signTransaction(addInitialLiquidityTx);
                addInitialLiquidityTx.applySignature(
                    addInitialLiquiditySignature
                );

                const addInitialLiquidityTxHash =
                    await walletProvider.sendTransaction(addInitialLiquidityTx);
                const addInitialLiquidityTxURL =
                    walletProvider.getTransactionURL(addInitialLiquidityTxHash);

                if (debugModeOn) {
                    elizaLogger.log("Step 4/6: addInitialLiquidity");
                    elizaLogger.log(
                        "addInitialLiquidity transaction sent successfully"
                    );
                    elizaLogger.log(
                        `Transaction URL: ${addInitialLiquidityTxURL}`
                    );
                }

                const addInitialLiquidityWatcher = new TransactionWatcher(
                    apiNetworkProvider
                );
                const addInitialLiquidityTransactionOnNetwork =
                    await addInitialLiquidityWatcher.awaitCompleted(
                        addInitialLiquidityTx
                    );

                if (
                    "status" in
                        addInitialLiquidityTransactionOnNetwork.status &&
                    addInitialLiquidityTransactionOnNetwork.status.status ===
                        "success"
                ) {
                    if (debugModeOn) {
                        elizaLogger.log(
                            "addInitialLiquidity transaction success, locking LP token.."
                        );
                    }
                    callback?.({
                        text: `Step 4/6: Initial Liquidity added successfully, locking LP token..`,
                    });
                } else {
                    throw new Error(
                        "❌ addInitialLiquidity transaction failed."
                    );
                }
            } catch (error) {
                const errMsg = extractErrorMessage(error);
                elizaLogger.error(
                    "❌ Error during liquidity pool creation:",
                    errMsg
                );

                callback?.({
                    text: `An error occurred while creating the liquidity pool: ${errMsg}`,
                });

                return false;
            }

            // Step 5: Lock LP Token

            let lpTokenIdentifier;

            try {
                lpTokenIdentifier = await findTokenIdentifier(lpTokenTicker);
                const lpTokenBalance = await findTokenBalance(lpTokenTicker);

                const lockTokensVariables = {
                    inputTokens: {
                        tokenID: lpTokenIdentifier,
                        nonce: 0,
                        amount: lpTokenBalance,
                    },
                    lockEpochs: 4,
                    simpleLockAddress: networkConfig.xExchangeLockAddress,
                };
                if (debugModeOn) {
                    elizaLogger.log("🔵 Sending GraphQL request:");
                    elizaLogger.log("Query:", lockTokensQuery);
                    elizaLogger.log(
                        "Variables:",
                        JSON.stringify(lockTokensVariables, null, 2)
                    );
                }

                // Sending the GraphQL query with the defined variables
                const lockTokensResponse = await graphqlProvider.query<any>(
                    lockTokensQuery,
                    lockTokensVariables
                );

                if (debugModeOn) {
                    elizaLogger.log("🟢 Received GraphQL response:");
                    elizaLogger.log(
                        JSON.stringify(lockTokensResponse, null, 2)
                    );
                }

                // Prepare and send the transaction
                const lockTokensBroadcast = {
                    sender: address,
                    receiver: lockTokensResponse.lockTokens.receiver,
                    data: TransactionPayload.fromEncoded(
                        lockTokensResponse.lockTokens.data
                    ),
                    nonce: await walletProvider
                        .getAccount(walletProvider.getAddress())
                        .then((account) => account.nonce),
                    gasLimit: lockTokensResponse.lockTokens.gasLimit,
                    chainID: lockTokensResponse.lockTokens.chainID,
                };

                const lockTokensTx = new Transaction(lockTokensBroadcast);
                const lockTokensSignature =
                    await walletProvider.signTransaction(lockTokensTx);
                lockTokensTx.applySignature(lockTokensSignature);

                const lockTokensTxHash =
                    await walletProvider.sendTransaction(lockTokensTx);
                const lockTokensTxURL =
                    walletProvider.getTransactionURL(lockTokensTxHash);

                if (debugModeOn) {
                    elizaLogger.log("Step 5/6: lockTokens");
                    elizaLogger.log("lockTokens transaction sent successfully");
                    elizaLogger.log(`Transaction URL: ${lockTokensTxURL}`);
                }

                const lockTokensWatcher = new TransactionWatcher(
                    apiNetworkProvider
                );
                const lockTokensTransactionOnNetwork =
                    await lockTokensWatcher.awaitCompleted(lockTokensTx);

                if (
                    "status" in lockTokensTransactionOnNetwork.status &&
                    lockTokensTransactionOnNetwork.status.status === "success"
                ) {
                    if (debugModeOn) {
                        elizaLogger.log(
                            "lockTokens transaction success, enabling swap.."
                        );
                    }
                    callback?.({
                        text: `Step 5/6: LP Token locked successfully, enabling swap..`,
                    });
                } else {
                    throw new Error("❌ lockTokens transaction failed.");
                }
            } catch (error) {
                const errMsg = extractErrorMessage(error);
                elizaLogger.error(
                    "❌ Error during liquidity pool creation:",
                    errMsg
                );

                callback?.({
                    text: `An error occurred while creating the liquidity pool: ${errMsg}`,
                });

                return false;
            }

            // Step 6: Enable Swap

            try {
                const createPoolUserLpsVariables = {
                    offset: 0,
                    limit: 1000,
                };

                if (debugModeOn) {
                    elizaLogger.log("🔵 Sending first GraphQL request:");
                    elizaLogger.log("Query:", createPoolUserLpsQuery);
                    elizaLogger.log(
                        "Variables:",
                        JSON.stringify(createPoolUserLpsVariables, null, 2)
                    );
                }

                // Sending the first GraphQL query with the defined variables
                const createPoolUserLpsResponse =
                    await graphqlProvider.query<any>(
                        createPoolUserLpsQuery,
                        createPoolUserLpsVariables
                    );

                if (debugModeOn) {
                    elizaLogger.log("🟢 Received GraphQL response:");
                    elizaLogger.log(
                        JSON.stringify(createPoolUserLpsResponse, null, 2)
                    );
                }

                const userLockedEsdtTokens =
                    createPoolUserLpsResponse?.userNfts?.userLockedEsdtToken ||
                    [];

                const selectedToken = userLockedEsdtTokens.find(
                    (token) => token.name === lpTokenIdentifier
                );

                let setSwapEnabledByUserResponse;

                if (selectedToken) {
                    const setSwapEnabledByUserVariables = {
                        inputTokens: {
                            amount: selectedToken.balance,
                            attributes: selectedToken.attributes,
                            nonce: selectedToken.nonce,
                            tokenID: selectedToken.ticker,
                        },
                    };
                    if (debugModeOn) {
                        elizaLogger.log(
                            "🔵 Sending next GraphQL request with variables:"
                        );
                        elizaLogger.log(
                            JSON.stringify(
                                setSwapEnabledByUserVariables,
                                null,
                                2
                            )
                        );
                    }

                    // Sending the second GraphQL query with the defined variables
                    setSwapEnabledByUserResponse =
                        await graphqlProvider.query<any>(
                            setSwapEnabledByUserQuery,
                            setSwapEnabledByUserVariables
                        );

                    if (debugModeOn) {
                        elizaLogger.log("🟢 Received GraphQL response:");
                        elizaLogger.log(
                            JSON.stringify(
                                setSwapEnabledByUserResponse,
                                null,
                                2
                            )
                        );
                    }
                } else {
                    elizaLogger.error(
                        "⚠️ Locked LP Token not found, request canceled."
                    );
                }

                // Prepare and send the transaction
                const swapData =
                    setSwapEnabledByUserResponse.setSwapEnabledByUser;

                const setSwapEnabledByUserBroadcast = {
                    sender: address,
                    receiver: swapData.receiver,
                    data: TransactionPayload.fromEncoded(swapData.data),
                    nonce: await walletProvider
                        .getAccount(walletProvider.getAddress())
                        .then((account) => account.nonce),
                    gasLimit: swapData.gasLimit,
                    chainID: swapData.chainID,
                };

                const setSwapEnabledByUserTx = new Transaction(
                    setSwapEnabledByUserBroadcast
                );
                const setSwapEnabledByUserSignature =
                    await walletProvider.signTransaction(
                        setSwapEnabledByUserTx
                    );
                setSwapEnabledByUserTx.applySignature(
                    setSwapEnabledByUserSignature
                );

                const setSwapEnabledByUserTxHash =
                    await walletProvider.sendTransaction(
                        setSwapEnabledByUserTx
                    );
                const setSwapEnabledByUserTxURL =
                    walletProvider.getTransactionURL(
                        setSwapEnabledByUserTxHash
                    );

                if (debugModeOn) {
                    elizaLogger.log("Step 6/6: setSwapEnabledByUser");
                    elizaLogger.log(
                        "setSwapEnabledByUser transaction sent successfully"
                    );
                    elizaLogger.log(
                        `Transaction URL: ${setSwapEnabledByUserTxURL}`
                    );
                }

                const setSwapEnabledByUserWatcher = new TransactionWatcher(
                    apiNetworkProvider
                );
                const setSwapEnabledByUserTransactionOnNetwork =
                    await setSwapEnabledByUserWatcher.awaitCompleted(
                        setSwapEnabledByUserTx
                    );

                if (
                    "status" in
                        setSwapEnabledByUserTransactionOnNetwork.status &&
                    setSwapEnabledByUserTransactionOnNetwork.status.status ===
                        "success"
                ) {
                    if (debugModeOn) {
                        elizaLogger.log(
                            `setSwapEnabledByUser transaction success, the pool ${lpTokenTicker} is ready.`
                        );
                    }
                    callback?.({
                        text: `Step 6/6: Swap enabled successfully. Your pool ${lpTokenTicker} is now ready.`,
                    });
                } else {
                    throw new Error(
                        "❌ setSwapEnabledByUser transaction failed."
                    );
                }
            } catch (error) {
                const errMsg = extractErrorMessage(error);
                elizaLogger.error(
                    "❌ Error during liquidity pool creation:",
                    errMsg
                );

                callback?.({
                    text: `An error occurred while creating the liquidity pool: ${errMsg}`,
                });

                return false;
            }

            return true;
        } catch (error) {
            const errMsg = extractErrorMessage(error);
            elizaLogger.error(
                "❌ Error during liquidity pool creation:",
                errMsg
            );

            callback?.({
                text: `An error occurred while creating the liquidity pool: ${errMsg}`,
            });

            return false;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "I want to create a liquidity pool with one million Kwak and twenty EGLD.",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Creating a liquidity pool with 20 EGLD and 1,000,000 Kwak...",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Can you set up a pool for 500,000 KWAK and 10 EGLD?",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Initializing a liquidity pool with 10 EGLD and 500K Kwak...",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "I'd like to create a new trading pair: 2M Kwak against 40 EGLD.",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Setting up a new liquidity pool with 40 EGLD and 2,000,000 Kwak...",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Open a pool with one and a half million Kwak and thirty EGLD.",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Creating a new pool with 30 EGLD and 1.5M Kwak...",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Set up a pool: 2.5 million Kwak and 50 EGLD.",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Initializing a new pool with 50 EGLD and 2,500,000 Kwak...",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
