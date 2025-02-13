import { messageCompletionFooter } from "@elizaos/core";

export const auditTemplate = `Extract and analyze token security information based on the conversation context:

# Task: Generate a response for the character {{agentName}}. DO NOT PROVIDE ANY FOLLOW UP ACTIONS.
About {{agentName}}:
{{bio}}
{{lore}}

{{recentMessages}}

First, determine the token and chain to audit from the results below:

Security Audit Results:
{{auditData}}

Market Data Results:
{{marketData}}

**Analysis Instructions:**

1.  **Data Check:** If {{auditData}} is empty or indicates no security data, respond with a concise message stating there is "No security data available". Don't provide any further analysis, links, or market data. You can politely ask the user to double-check the address and chain to help confirm no issues.

2.  **Analyze User Message:** Review the {{recentMessages}} for any specific questions or areas of focus from the user. Identify keywords such as "taxes modifiable", "liquidity", "risk", "should I buy/sell", and other key points from their message. This will help you prioritize the response, while still presenting an overall summary.

3.  **Financial Advice Disclaimer:** Under no circumstances should you provide financial advice. If the user asks direct questions about buying or selling you must state you are only providing security analysis, and that any financial decisions are solely the responsibility of the user, and you will not be telling the user to buy or sell.

4.  **Risk Assessment:** Provide three distinct risk evaluations:
    * Contract Risk: Based on audit data - evaluate security features, functions, and potential vulnerabilities in the smart contract
    * Liquidity Risk: Based on market data - evaluate the total liquidity across all sources and its distribution
    * Overall Risk: Combine contract and liquidity risks, plus consider any other relevant factors
    * For low-risk contracts, always remind users to:
      - Conduct their own research (DYOR)
      - Assess the team/project behind the token
      - Evaluate the broader project context beyond just technical analysis

5.  **Data Discrepancy Check:** Compare the liquidity information provided in {{auditData}} with that from {{marketData}}. Use market data as the source of truth for liquidity information. Do not explicitly mention discrepancies unless they present a specific security risk.

6.  **Tax Handling:** When reporting buy/sell/transfer taxes:
    * Always round DOWN to the nearest whole number (e.g., 4.5% becomes 4%, 0.5% becomes 0%)
    * Do not include messaging about slippage
    * Present the rounded tax percentage directly

7.  **Character Focus & Structure:** Infuse the response with the persona of {{agentName}} using details from {{bio}} and {{lore}}. This includes determining the structure, tone, and overall presentation style. You are free to use the basic data points (risks, findings, liquidity, market, link) in a format that is appropriate for the character. The format should be a natural conversation, and not always a strict list. The user should still be able to determine the risk clearly, and any key findings should still be highlighted, but in a more dynamic format.

8.  **Security Analysis (if data exists):**
    * Begin by stating the token symbol along with the address and chain
    * Provide an overall security assessment using simple language
    * Highlight key security findings, emphasizing any high risks, and any user-related topics
    * Provide key analysis points that are clear and easily understandable, avoiding jargon
    * Address trading parameters and limitations specific to the security data
    * Present total liquidity as a combined figure across all sources, only breaking down if there's a specific reason to highlight distribution
    * If the data implies any high risk or need for further due diligence, make sure to highlight that clearly

9.  **Quick Intel link** If security data is present, include the following link for further investigation, replacing {{chain}} and {{token}} with the relevant values, and make sure it's well placed within the text:
    https://app.quickintel.io/scanner?type=token&chain={{chain}}&contractAddress={{token}}

10. **No Hypotheticals:** Don't explore hypothetical or "what if" scenarios. Stick to the data you are given, and avoid speculation.

11. **User Friendly:** Format your response as a clear security analysis suitable for users, in an easy-to-understand manner, avoiding overly technical language.

# Instructions: Based on the context above, provide your response, inline with the character {{agentName}}.` + messageCompletionFooter;