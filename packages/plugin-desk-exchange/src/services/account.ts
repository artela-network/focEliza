import { AxiosResponse } from "axios";
import axios from "axios";

export const getSubaccountSummary = async (
    endpoint: string,
    jwt: string,
    subaccount: string
): Promise<AxiosResponse> => {
    if (!endpoint || !jwt || !subaccount) {
        throw new Error("Missing required parameters");
    }
    return await axios.get(`${endpoint}/v2/subaccount-summary/${subaccount}`, {
        headers: {
            authorization: `Bearer ${jwt}`,
            "content-type": "application/json",
        },
        timeout: 5000,
        validateStatus: (status) => status === 200,
    });
};
