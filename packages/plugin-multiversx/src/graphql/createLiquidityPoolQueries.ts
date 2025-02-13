import { gql } from "graphql-request";

// 1. Create Pair
const createPairString = `
  query createPair($firstTokenID: String!, $secondTokenID: String!) {
    createPair(firstTokenID: $firstTokenID, secondTokenID: $secondTokenID) {
      nonce
      sender
      receiver
      data
      gasLimit
      chainID
    }
  }
`;

export const createPairQuery = gql`
    ${createPairString}
`;

// 2. Get the Pool SC address
const createPoolFilterWithoutLpString = `
  query createPoolFilterWithoutLp($firstTokenID: String!, $secondTokenID: String!) {
    filteredPairs(filters: { issuedLpToken: false, firstTokenID: $firstTokenID, secondTokenID: $secondTokenID }, pagination: { first: 1 }) {
      edges {
        node {
          address
          state
        }
      }
    }
  }
`;

export const createPoolFilterWithoutLpQuery = gql`
    ${createPoolFilterWithoutLpString}
`;

// 3. Issue LP Token
const createPoolCreatePoolToken = `
  query createPoolCreatePoolToken($lpTokenName: String!, $lpTokenTicker: String!, $address: String!) {
    issueLPToken(lpTokenName: $lpTokenName, lpTokenTicker: $lpTokenTicker, address: $address) {
      value
      receiver
      gasPrice
      gasLimit
      data
      chainID
      version
    }
  }
`;

export const createPoolCreatePoolTokenQuery = gql`
    ${createPoolCreatePoolToken}
`;

// 4. Set local Roles
const createPoolSetLocalRolesString = `
  query createPoolSetLocalRoles($address: String!) {
    setLocalRoles(address: $address) {
      value
      receiver
      gasPrice
      gasLimit
      data
      chainID
      version
    }
  }
`;

export const createPoolSetLocalRolesQuery = gql`
    ${createPoolSetLocalRolesString}
`;

// 5. Add initial liquidity and set Initial rate
const createPoolSetInitialExchangeRateString = `
  query createPoolSetInitialExchangeRate($pairAddress: String!, $tokens: [InputTokenModel!]!, $tolerance: Float!) {
    addInitialLiquidityBatch(pairAddress: $pairAddress, tokens: $tokens, tolerance: $tolerance) {
      value
      receiver
      gasPrice
      gasLimit
      data
      chainID
      version
    }
  }
`;

export const createPoolSetInitialExchangeRateQuery = gql`
    ${createPoolSetInitialExchangeRateString}
`;

// 6.  Add Liquidity (Optionnal)
const createPoolAddLiquidityString = `
  query createPoolAddLiquidity($tolerance: Float!, $pairAddress: String!, $tokens: [InputTokenModel!]!) {
    addLiquidityBatch(tokens: $tokens, tolerance: $tolerance, pairAddress: $pairAddress) {
      value
      receiver
      gasPrice
      gasLimit
      data
      chainID
      version
    }
  }
`;

export const createPoolAddLiquidityQuery = gql`
    ${createPoolAddLiquidityString}
`;

// 7. Lock LP Token
const lockTokensString = `
  query ($inputTokens: InputTokenModel!, $lockEpochs: Float!, $simpleLockAddress: String!) {
    lockTokens(inputTokens: $inputTokens, lockEpochs: $lockEpochs, simpleLockAddress: $simpleLockAddress) {
      value
      receiver
      gasPrice
      gasLimit
      data
      chainID
      version
    }
  }
`;

export const lockTokensQuery = gql`
    ${lockTokensString}
`;

//8. Get the locked LPs

const createPoolUserLpsString = `
  query createPoolUserLps($offset: Int, $limit: Int) {
    userNfts(offset: $offset, limit: $limit) {
      userLockedEsdtToken {
        name
        ticker
        attributes
        balance
        nonce
      }
    }
  }
`;

export const createPoolUserLpsQuery = gql`
    ${createPoolUserLpsString}
`;

//9. Enable swap
const setSwapEnabledByUserString = `
  query ($inputTokens: InputTokenModel!) {
    setSwapEnabledByUser(inputTokens: $inputTokens) {
      value
      receiver
      gasPrice
      gasLimit
      data
      chainID
      version
    }
  }
`;

export const setSwapEnabledByUserQuery = gql`
    ${setSwapEnabledByUserString}
`;

// Wrap EGLD

const wrapEgldString = `
  query swapPackageWrapEgld($wrappingAmount: String!) {
    wrapEgld(amount: $wrappingAmount) {
      value
      receiver
      gasPrice
      gasLimit
      data
      chainID
      version
      __typename
    }
  }
`;

export const wrapEgldQuery = gql`
    ${wrapEgldString}
`;
