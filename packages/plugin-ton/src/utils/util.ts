import { beginCell, Cell, internal, SendMode } from "@ton/ton";
import pinataSDK from "@pinata/sdk";

import { readdirSync } from "fs";
import { writeFile, readFile } from "fs/promises";
import path from "path";
import { MintParams } from "./NFTCollection";
export const sleep = async (ms: number) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
};

export const base64ToHex = (base64: string) => {
    return Buffer.from(base64, "base64").toString("hex");
};

export function bufferToChunks(buff: Buffer, chunkSize: number) {
    const chunks: Buffer[] = [];
    while (buff.byteLength > 0) {
      chunks.push(buff.subarray(0, chunkSize));
      buff = buff.subarray(chunkSize);
    }
    return chunks;
  }

 export  function makeSnakeCell(data: Buffer): Cell {
    const chunks = bufferToChunks(data, 127);
  
    if (chunks.length === 0) {
      return beginCell().endCell();
    }
  
    if (chunks.length === 1) {
      return beginCell().storeBuffer(chunks[0]).endCell();
    }
  
    let curCell = beginCell();
  
    for (let i = chunks.length - 1; i >= 0; i--) {
      const chunk = chunks[i];
  
      curCell.storeBuffer(chunk);
  
      if (i - 1 >= 0) {
        const nextCell = beginCell();
        nextCell.storeRef(curCell);
        curCell = nextCell;
      }
    }
  
    return curCell.endCell();
  }

  export function encodeOffChainContent(content: string) {
    let data = Buffer.from(content);
    const offChainPrefix = Buffer.from([0x01]);
    data = Buffer.concat([offChainPrefix, data]);
    return makeSnakeCell(data);
  }

  export async function waitSeqno(seqno: number, wallet) {
    for (let attempt = 0; attempt < 10; attempt++) {
      await sleep(2000);
      const seqnoAfter = await wallet.contract.getSeqno();
      if (seqnoAfter == seqno + 1) break;
    }
  }
  
  export async function uploadFolderToIPFS(folderPath: string): Promise<string> {
  const pinata = new pinataSDK({
    pinataApiKey: process.env.PINATA_API_KEY,
    pinataSecretApiKey: process.env.PINATA_API_SECRET,
  });

  const response = await pinata.pinFromFS(folderPath);
  return response.IpfsHash;
}

export async function updateMetadataFiles(metadataFolderPath: string, imagesIpfsHash: string): Promise<void> {
  const files = readdirSync(metadataFolderPath);

  files.forEach(async (filename, index) => {
    const filePath = path.join(metadataFolderPath, filename)
    const file = await readFile(filePath);
    
    const metadata = JSON.parse(file.toString());
    metadata.image =
      index != files.length - 1
        ? `ipfs://${imagesIpfsHash}/${index}.jpg`
        : `ipfs://${imagesIpfsHash}/logo.jpg`;
    
    await writeFile(filePath, JSON.stringify(metadata));
  });
}

export async function uploadJSONToIPFS(json: any): Promise<string> {
  const pinata = new pinataSDK({
    pinataApiKey: process.env.PINATA_API_KEY,
    pinataSecretApiKey: process.env.PINATA_API_SECRET,
  });

  const response = await pinata.pinJSONToIPFS(json);
  return response.IpfsHash;
}

export async function topUpBalance(  
    wallet,
    nftAmount: number,
    collectionAddress: string
  ): Promise<number> {
    const feeAmount = 0.026 // approximate value of fees for 1 transaction in our case 
    const seqno = await wallet.contract.getSeqno();
    const amount = nftAmount * feeAmount;

    await wallet.contract.sendTransfer({
      seqno,
      secretKey: wallet.keyPair.secretKey,
      messages: [
        internal({
          value: amount.toString(),
          to: collectionAddress,
          bounce: false,
        }),
      ],
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    });

    return seqno;
  }
