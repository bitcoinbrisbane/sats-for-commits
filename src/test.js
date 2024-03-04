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
  const url = `https://api.blockcypher.com/v1/btc/test3/addrs/${address}?unspentOnly=true`;
  const response = await axios.get(url);
  const unspent = response.data.txrefs[0];
  return unspent;
};

const getAUtxo = async (txid, to, amount) => {
  // const url = `https://api.blockcypher.com/v1/btc/test3/txs/${txid}`;
  const url = `https://blockstream.info/testnet/api/tx/${txid}`;
  const response = await axios.get(url);

  const utxos = response.data.vout;
  const utxo = utxos.find(
    (vout) => vout.value >= amount && vout.scriptpubkey_address === to
  );
  return utxo;
};

const test = async () => {
  const coin = network === bitcoin.networks.testnet ? "1" : "0";
  const path = `m/44'/${coin}'/0'/0/1/0`;
  const mnemonic =
    "praise you muffin lion enable neck grocery crumble super myself license ghost";
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, network);
  const child = root.derivePath(path);
  const privateKeyBuffer = child.privateKey;

  const address = bitcoin.payments.p2wpkh({
    pubkey: child.publicKey,
    network: network,
  });

  // https://live.blockcypher.com/btc-testnet/address/tb1q26y7u4jw3canmy3g637tna7qpr0degnzvv0fh0/
  // tb1q26y7u4jw3canmy3g637tna7qpr0degnzvv0fh0
  console.log(address.address);

  // example https://bitcoin.stackexchange.com/questions/118945/how-to-build-a-transaction-using-bitcoinjs-lib
  const psbt = new bitcoin.Psbt({ network: network });

  const from = "tb1q26y7u4jw3canmy3g637tna7qpr0degnzvv0fh0";
  const unspent = await getUnspent(from);

  const utxo = await getAUtxo(unspent.tx_hash, from, 1000);

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

  const input = {
    hash: "1abe5599863a47355ce106dd13ec1108f31ce5dd7f9e2564546abc26bc5b420c",
    index: 0,
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
  // https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/transactions.spec.ts#L24C5-L26C7
  const pk = ECPair.fromWIF(privateKeyAsHex, network);

  psbt.signInput(0, pk);
  psbt.finalizeInput(0);
  //const tx = psbt.extractTransaction();
  console.log(tx.toHex());

  // const txid = await broadcast(txHex);
  // return txid;

  // Convert the private key to WIF (Wallet Import Format) for easier use and readability
  // const privateKeyWIF = bitcoin.ECPair.fromPrivateKey(privateKeyBuffer);

  //   const account = new CryptoAccount(
  //     Buffer.from(privateKeyBuffer, "hex", { network: testnet })
  //   );

  //   console.log(await account.address("BTC"));
  //   const balance = await account.getBalance("BTC");

  //   console.log(balance);
  //   if (balance < amount) {
  //     console.log("Insufficient funds");
  //     return;
  //   }

  //   console.log(await account.send("BTC", to, amount));
};

test();
