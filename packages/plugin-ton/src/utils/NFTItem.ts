import { Address, beginCell, Cell, internal, SendMode, TonClient } from "@ton/ton";
import { MintParams, NFTCollection } from "./NFTCollection";

export async function getAddressByIndex(
    client: TonClient,
    collectionAddress: Address,
    itemIndex: number
  ): Promise<Address> {
    const response = await client.runMethod(
        collectionAddress,
        "get_nft_address_by_index",
        [{ type: "int", value: BigInt(itemIndex) }]
      );
      return response.stack.readAddress();
  }

export class NftItem {
    private readonly collectionAddress: Address
  
    constructor(collection: string ) {
      this.collectionAddress = Address.parse(collection);
    }

    public createMintBody(params: MintParams): Cell {
        const body = beginCell();
        body.storeUint(1, 32);
        body.storeUint(params.queryId || 0, 64);
        body.storeUint(params.itemIndex, 64);
        body.storeCoins(params.amount);
        const nftItemContent = beginCell();
        nftItemContent.storeAddress(params.itemOwnerAddress);
        const uriContent = beginCell();
        uriContent.storeBuffer(Buffer.from(params.commonContentUrl));
        nftItemContent.storeRef(uriContent.endCell());
        body.storeRef(nftItemContent.endCell());
        return body.endCell();
    }
  
    public async deploy(
      wallet,
      params: MintParams
    ): Promise<number> {
      const seqno = await wallet.contract.getSeqno();
      await wallet.contract.sendTransfer({
        seqno,
        secretKey: wallet.keyPair.secretKey,
        messages: [
          internal({
            value: "0.05",
            to: this.collectionAddress,
            body: this.createMintBody(params),
          }),
        ],
        sendMode: SendMode.IGNORE_ERRORS + SendMode.PAY_GAS_SEPARATELY,
      });
      return seqno;
    }
  }
