const { BIP32Factory } = require("bip32");
const { ECPairFactory } = require("ecpair");

const ecc = require("tiny-secp256k1");
const bip32 = BIP32Factory(ecc);
const bip39 = require("bip39");
const bitcoin = require("bitcoinjs-lib");

const axios = require("axios");
const ECPair = ECPairFactory(ecc);
const network = bitcoin.networks.testnet;

// https://github.com/bitcoinbrisbane/test-for-commits/issues/11
const ISSUE_ADDRESS = "tb1qxepdrdkm45lyh8sa8hfd3jqamgjamlk49gyl3m";

// Get TxIDs for an address
const getUnspentTxIDs = async (address) => {
  const url = `https://api.blockcypher.com/v1/btc/test3/addrs/${address}`;
  const response = await axios.get(url);
  const unspent = response.data;

  const filtered = unspent.txrefs.filter((txref) => txref.spent === false);
  const ids = filtered.txrefs.map((txref) => txref.tx_hash);

  return ids
};

const getAllUtxos = async (txid, to) => {
  const url = `https://blockstream.info/testnet/api/tx/${txid}?unspent=true`;
  console.log(url);
  const response = await axios.get(url);

  const utxos = response.data.vout;
  const _utxos = utxos.find((vout) => vout.scriptpubkey_address === to);
  return _utxos;
};

const getAUtxos = async (txid, to, amount) => {
  // const url = `https://api.blockcypher.com/v1/btc/test3/txs/${txid}`;
  const url = `https://blockstream.info/testnet/api/tx/${txid}`;
  console.log(url);
  const response = await axios.get(url);

  const utxos = response.data.vout;
  const utxo = utxos.find(
    (vout) => vout.value >= amount && vout.scriptpubkey_address === to
  );
  return utxo;
};

const getTxAsHex = async (txid) => {
  // https://blockstream.info/testnet/api/tx/1abe5599863a47355ce106dd13ec1108f31ce5dd7f9e2564546abc26bc5b420c/hex
  const url = `https://blockstream.info/testnet/api/tx/${txid}/hex`;
  console.log(url);
  const response = await axios.get(url);
  return response.data;
};

const broadcast = async (txHex) => {
  const url = `https://blockstream.info/testnet/api/tx`;
  console.log(url);
  const response = await axios.post(url, txHex);
  return response.data;
};

const test = async () => {
  const TX_ID =
    "1abe5599863a47355ce106dd13ec1108f31ce5dd7f9e2564546abc26bc5b420c";

  const coin = network === bitcoin.networks.testnet ? "1" : "0";
  const path = `m/44'/${coin}'/0'/0/1/0`;
  const mnemonic =
    "praise you muffin lion enable neck grocery crumble super myself license ghost";
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, network);
  const child = root.derivePath(path);

  const address = bitcoin.payments.p2wpkh({
    pubkey: child.publicKey,
    network: network,
  });

  // https://live.blockcypher.com/btc-testnet/address/tb1q26y7u4jw3canmy3g637tna7qpr0degnzvv0fh0/
  // tb1q26y7u4jw3canmy3g637tna7qpr0degnzvv0fh0
  console.log("to: " + address.address);

  // example https://bitcoin.stackexchange.com/questions/118945/how-to-build-a-transaction-using-bitcoinjs-lib
  const psbt = new bitcoin.Psbt({ network: network });

  const from = address.address;

  const unspent = await getUnspent(from);
  const utxo = await getAUtxo(TX_ID, from, 1000);

  const txAsHex = await getTxAsHex(TX_ID);

  const input = {
    hash: TX_ID,
    index: 0,
    nonWitnessUtxo: Buffer.from(txAsHex, "hex"),
  };

  psbt.addInput(input);

  const output = {
    address: ISSUE_ADDRESS,
    value: 1000,
  };

  psbt.addOutput(output);

  // https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/transactions.spec.ts#L24C5-L26C7
  const pk = ECPair.fromWIF(child.toWIF(), network);

  psbt.signInput(0, pk);
  psbt.finalizeInput(0);

  const txHex = psbt.extractTransaction().toHex();

  console.log("tx to broadcast: ");
  console.log(txHex);

  const txid = await broadcast(txHex);
  return txid;
};

test();
