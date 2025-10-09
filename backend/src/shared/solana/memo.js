import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { toPublicKey, ensureMemoString } from './helpers.js';

export const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export function buildMemoInstruction({ memo, signer }) {
  const memoText = ensureMemoString(memo);
  const signerPk = toPublicKey(signer, 'memo signer');

  return new TransactionInstruction({
    programId: MEMO_PROGRAM_ID,
    keys: [
      {
        pubkey: signerPk,
        isSigner: true,
        isWritable: false,
      },
    ],
    data: Buffer.from(memoText, 'utf8'),
  });
}
