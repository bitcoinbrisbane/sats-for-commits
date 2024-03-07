const { BIP32Factory } = require("bip32");
const { ECPairFactory } = require("ecpair");

const ecc = require("tiny-secp256k1");
const bip32 = BIP32Factory(ecc);
const bip39 = require("bip39");
const bitcoin = require("bitcoinjs-lib");
// const CryptoAccount = require("send-crypto");
// const { testnet } = require("bitcoinjs-lib/src/networks");
const axios = require("axios");

// const ECPairFactory = require("");
const ECPair = ECPairFactory(ecc);

const network = bitcoin.networks.testnet;

// https://github.com/bitcoinbrisbane/test-for-commits/issues/11
const ISSUE_ADDRESS = "tb1qxepdrdkm45lyh8sa8hfd3jqamgjamlk49gyl3m";

const getUnspent = async (address) => {
  const url = `https://api.blockcypher.com/v1/btc/test3/addrs/${address}`;
  const response = await axios.get(url);
  const unspent = response.data;
  return unspent;
};

const getAUtxo = async (txid, to, amount) => {
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

const getAUtxoAsHex = async (txid) => {
  // const url = `https://api.blockcypher.com/v1/btc/test3/txs/${txid}`;
  const url = `https://blockstream.info/testnet/api/tx/${txid}/hex`;
  console.log(url);
  const response = await axios.get(url);

  console.log(response.data);
  return response.data;
};

const test = async () => {
  const coin = network === bitcoin.networks.testnet ? "1" : "0";
  const path = `m/84'/${coin}'/0'/0/1/0`;
  const mnemonic =
    "praise you muffin lion enable neck grocery crumble super myself license ghost";
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, network);
  const child = root.derivePath(path);

  const wif = child.toWIF();
  const privateKeyBuffer = child.privateKey;

  const address = bitcoin.payments.p2wpkh({
    pubkey: child.publicKey,
    network: network,
  });

  // https://live.blockcypher.com/btc-testnet/address/tb1q26y7u4jw3canmy3g637tna7qpr0degnzvv0fh0/
  // tb1q26y7u4jw3canmy3g637tna7qpr0degnzvv0fh0
  console.log("to: " + address.address);

  // https://github.com/bitcoinjs/bitcoinjs-lib/issues/1565
  // example https://bitcoin.stackexchange.com/questions/118945/how-to-build-a-transaction-using-bitcoinjs-lib
  const psbt = new bitcoin.Psbt({ network: network });

  const from = address.address; // "tb1q26y7u4jw3canmy3g637tna7qpr0degnzvv0fh0";
  const unspent = await getUnspent(from);
  console.log(unspent);

  const utxo = await getAUtxo(unspent.tx_hash, from, 1000);
  console.log(utxo);

  //   psbt.addInput({
  //     hash: unspent.tx_hash,
  //     index: 0,
  //     witnessUtxo: {
  //       script: Buffer.from(
  //         utxo.scriptpubkey,
  //         "hex"
  //       ),
  //       value: utxo.value,
  //     },
  //     redeemScript: Buffer.from(utxo.scriptpubkey, "hex"),
  //   });

//   const output_script = bitcoin.payments.p2wpkh({
//     pubkey: pubKey, network: network
// }).output

  // psbt.addInput({
  //   hash: input.txid,
  //   index: input.vout,
  //   // witnessUtxo: {script: output_script , value: input.value }
  //   nonWitnessUtxo: Buffer.from(input.txHex, 'hex'),
  // })

  const utxoHex = await getAUtxoAsHex(unspent.tx_hash);
  // console.log(utxoHex);

  // https://not-satoshi.com/unlocking-the-secrets-sending-raw-bitcoin-transactions-with-javascript-made-simple/
  const input = {
    hash: "1abe5599863a47355ce106dd13ec1108f31ce5dd7f9e2564546abc26bc5b420c",
    index: 0,
    nonWitnessUtxo: Buffer.from(utxoHex, "hex"),
    // witnessUtxo: {
    //   script: Buffer.from(
    //     utxo.scriptpubkey,
    //     "hex"
    //   ),
    //   value: utxo.value,
    // },
    // redeemScript: Buffer.from(utxo.scriptpubkey, "hex"),
  };

  psbt.addInput(input);

  const output = {
    address: ISSUE_ADDRESS,
    value: 1000,
  };

  psbt.addOutput(output);

  const privateKeyAsHex = privateKeyBuffer.toString("hex");


  // const pk = ECPair.fromPrivateKey(privateKeyBuffer, network);
  // https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/transactions.spec.ts#L24C5-L26C7
  const pk = ECPair.fromWIF(wif, network);

  // psbt.signInput(0, pk);
  psbt.signAllInputs(pk);

  // psbt.finalizeInput(0);
  // //const tx = psbt.extractTransaction();
  // console.log(tx.toHex());

  // const txid = await broadcast(txHex);
  // return txid;

};

test();
