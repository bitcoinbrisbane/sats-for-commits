// import { CryptoAccount } from "crypto-account";
const { BIP32Factory } = require("bip32");
const ecc = require("tiny-secp256k1");
const bip32 = BIP32Factory(ecc);
const bip39 = require("bip39");
const bitcoin = require("bitcoinjs-lib");
const CryptoAccount = require("send-crypto");
const { testnet } = require("bitcoinjs-lib/src/networks");
const axios = require("axios");

const network = bitcoin.networks.testnet;

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

  const psbt = new bitcoin.Psbt();

  const from = "tb1q26y7u4jw3canmy3g637tna7qpr0degnzvv0fh0";
  const unspent = await getUnspent(from);

  const utxo = await getAUtxo(
    unspent.tx_hash,
    "tb1q26y7u4jw3canmy3g637tna7qpr0degnzvv0fh0",
    1000
  );

  psbt.addInput({
    hash: unspent.tx_hash,
    index: 0,
    witnessUtxo: {
      script: Buffer.from(
        "a914eb762ef1946c2d462764d30112ce27c531fdd60387",
        "hex"
      ),
      value: utxo.value,
    },
    redeemScript: Buffer.from(utxo.scriptpubkey, "hex"),
  });

  const tx = psbt.addInput(unspent.txid, unspent.vout);
  psbt.addOutput(to, amount);
  psbt.sign(0, keyPair);
  const txHex = psbt.build().toHex();
  // const txid = await broadcast(txHex);
  // return txid;

  // Convert the private key to WIF (Wallet Import Format) for easier use and readability
  // const privateKeyWIF = bitcoin.ECPair.fromPrivateKey(privateKeyBuffer);

  const account = new CryptoAccount(
    Buffer.from(privateKeyBuffer, "hex", { network: testnet })
  );

  console.log(await account.address("BTC"));
  const balance = await account.getBalance("BTC");

  console.log(balance);
  if (balance < amount) {
    console.log("Insufficient funds");
    return;
  }

  console.log(await account.send("BTC", to, amount));
};

test();
