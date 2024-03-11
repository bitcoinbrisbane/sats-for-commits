const { BIP32Factory } = require("bip32");
const { ECPairFactory } = require("ecpair");

const ecc = require("tiny-secp256k1");
const bip32 = BIP32Factory(ecc);
const bip39 = require("bip39");
const bitcoin = require("bitcoinjs-lib");

const axios = require("axios");
const ECPair = ECPairFactory(ecc);
const network = bitcoin.networks.testnet;

const FEE = 1000;

// load dotenv
require("dotenv").config();

// https://github.com/bitcoinbrisbane/test-for-commits/issues/11
const ISSUE_ADDRESS = "tb1qxepdrdkm45lyh8sa8hfd3jqamgjamlk49gyl3m";

const getMnemonic = () => {
  return (
    process.env.MNEMONIC ||
    "praise you muffin lion enable neck grocery crumble super myself license ghost"
  );
};


// Note, change will go to the treasury address or the user's address
const getUserAddress = (user_id) => {
  const coin = network === bitcoin.networks.testnet ? "1" : "0";
  const network_id = network === bitcoin.networks.testnet ? "84" : "44";
  const path = `m/${network_id}'/${coin}'/0'/0/0/${user_id}`;
  return getAddress(path);
};

// Repo treasury address
const getRepoAddress = (repo_id) => {
  const coin = network === bitcoin.networks.testnet ? "1" : "0";
  const network_id = network === bitcoin.networks.testnet ? "84" : "44";
  const path = `m/${network_id}'/${coin}'/0'/0/${repo_id}/0`;
  return getAddress(path);
};

const getIssueAddress = (repo_id, issue_id) => {
  const coin = network === bitcoin.networks.testnet ? "1" : "0";
  const network_id = network === bitcoin.networks.testnet ? "84" : "44";
  const path = `m/${network_id}'/${coin}'/0'/0/${repo_id}/${issue_id}`;
  return getAddress(path);
};

// todo: get from xpub key
const getAddress = (path) => {
  const mnemonic = getMnemonic();
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, network);
  const child = root.derivePath(path);
  const address = bitcoin.payments.p2wpkh({
    pubkey: child.publicKey,
    network: network,
  });
  return address.address;
};

const getChild = (account, index) => {
  const coin = network === bitcoin.networks.testnet ? "1" : "0";
  const path = `m/44'/${coin}'/0'/${account}/0/${index}`;
  const mnemonic = getMnemonic();
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, network);
  const child = root.derivePath(path);
  return child;
};

const getBalance = async (address) => {
  const url = `https://api.blockcypher.com/v1/btc/test3/addrs/${address}/balance`;
  const response = await axios.get(url);
  return response.data;
};

// Get TxIDs for an address
const getUnspentTxIDs = async (address) => {
  const url = `https://api.blockcypher.com/v1/btc/test3/addrs/${address}`;
  const response = await axios.get(url);
  const unspent = response.data;

  const filtered = unspent.txrefs.filter((txref) => txref.spent === false);
  const ids = filtered.map((txref) => txref.tx_hash);

  return ids;
};

const getAllUtxos = async (txid, to) => {
  const url = `https://blockstream.info/testnet/api/tx/${txid}?unspent=true`;
  console.log(url);
  const response = await axios.get(url);

  const utxos = response.data.vout;
  const _utxos = utxos.find((vout) => vout.scriptpubkey_address === to);
  return _utxos;
};

const getAUtxo = async (txid, to, amount) => {
  // const url = `https://api.blockcypher.com/v1/btc/test3/txs/${txid}`;
  const url = `https://blockstream.info/testnet/api/tx/${txid}`;
  console.log(url);
  const response = await axios.get(url);

  const utxos = response.data.vout;

  for (let i = 0; i < utxos.length; i++) {
    const vout = utxos[i];
    if (vout.scriptpubkey_address === to && vout.value >= amount) {
      return { index: i, vout: vout };
    }
  }
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

const sendAll = async (index, to) => {
  const TX_ID =
    "1abe5599863a47355ce106dd13ec1108f31ce5dd7f9e2564546abc26bc5b420c";

  const coin = network === bitcoin.networks.testnet ? "1" : "0";
  const path = `m/44'/${coin}'/0'/0/1/${index}`;

  const mnemonic = getMnemonic();
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, network);
  const child = root.derivePath(path);

  const from = bitcoin.payments.p2wpkh({
    pubkey: child.publicKey,
    network: network,
  });

  // https://live.blockcypher.com/btc-testnet/address/tb1q26y7u4jw3canmy3g637tna7qpr0degnzvv0fh0/
  // tb1q26y7u4jw3canmy3g637tna7qpr0degnzvv0fh0
  console.log("to: " + address.address);

  // example https://bitcoin.stackexchange.com/questions/118945/how-to-build-a-transaction-using-bitcoinjs-lib
  const psbt = new bitcoin.Psbt({ network: network });

  const amount = 1000;
  const unspent = await getUnspentTxIDs(from.address);
  const utxo = await getAUtxo(TX_ID, from.address, amount);
  const txAsHex = await getTxAsHex(TX_ID);

  const input = {
    hash: TX_ID,
    index: utxo.index,
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

const sendFromTreasury = async (repo_id, amount, to) => {
  const coin = network === bitcoin.networks.testnet ? "1" : "0";
  const network_id = network === bitcoin.networks.testnet ? "84" : "44";
  const path = `m/${network_id}'/${coin}'/0'/0/${repo_id}/0`;
  const mnemonic = getMnemonic();

  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, network);
  const child = root.derivePath(path);

  const treasury = bitcoin.payments.p2wpkh({
    pubkey: child.publicKey,
    network: network,
  });

  const treasuryBalance = await getBalance(treasury.address);

  if (treasuryBalance.balance < amount) {
    return;
  }

  // https://live.blockcypher.com/btc-testnet/address/tb1q26y7u4jw3canmy3g637tna7qpr0degnzvv0fh0/
  // tb1q26y7u4jw3canmy3g637tna7qpr0degnzvv0fh0
  const from = treasury.address;
  console.log("from: " + from);

  // example https://bitcoin.stackexchange.com/questions/118945/how-to-build-a-transaction-using-bitcoinjs-lib
  const psbt = new bitcoin.Psbt({ network: network });

  const unspentIDs = await getUnspentTxIDs(from);

  if (unspentIDs.length === 0) {
    console.log("No unspent txs");
    return;
  }

  const utxo = await getAUtxo(unspentIDs[0], from, amount);
  const txAsHex = await getTxAsHex(unspentIDs[0]);

  const input = {
    hash: unspentIDs[0],
    index: utxo.index,
    nonWitnessUtxo: Buffer.from(txAsHex, "hex"),
  };

  psbt.addInput(input);

  const output = {
    address: to,
    value: amount,
  };

  psbt.addOutput(output);

  const change = treasuryBalance.balance - amount - FEE;
  if (change > 0) {
    const changeOutput = {
      address: from,
      value: change,
    };
    psbt.addOutput(changeOutput);
  }

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

module.exports = {
  getIssueAddress,
  getRepoAddress,
  getUserAddress,
  getBalance,
  getMnemonic,
  sendFromTreasury,
};
