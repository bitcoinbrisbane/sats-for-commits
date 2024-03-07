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

const getTxAsHex = async (txid) => {
  // const url = `https://api.blockcypher.com/v1/btc/test3/txs/${txid}`;
  const url = `https://blockstream.info/testnet/api/tx/${txid}/hex`;
  console.log(url);
  const response = await axios.get(url);
  return response.data;
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
  console.log("to: " + address.address);

  // example https://bitcoin.stackexchange.com/questions/118945/how-to-build-a-transaction-using-bitcoinjs-lib
  const psbt = new bitcoin.Psbt({ network: network });

  const from = address.address; // "tb1q26y7u4jw3canmy3g637tna7qpr0degnzvv0fh0";

  // const utxo = await getAUtxo(unspent.tx_hash, from, 1000);
  const utxo = await getAUtxo(
    "1abe5599863a47355ce106dd13ec1108f31ce5dd7f9e2564546abc26bc5b420c",
    from,
    1000
  );

  const txAsHex = await getTxAsHex(
    "1abe5599863a47355ce106dd13ec1108f31ce5dd7f9e2564546abc26bc5b420c"
  );

  const input = {
    hash: "1abe5599863a47355ce106dd13ec1108f31ce5dd7f9e2564546abc26bc5b420c",
    index: 0,
    // nonWitnessUtxo: Buffer.from(
    //   "02000000013ca1ed4e6676989725e1b4789c3913d6a911faa834e748bc761a36401f41b961010000006a4730440220321ef65d33a1bc807824faf9f0e631ff35067ebf4afc36b3812f86ba4f0431d00220768541745bca5d242db3e4dcec1ab3589b57a02cd55b61e30aac5d8631ea04ad0121022dea88d56a1e8b3eb8f5ca59fd3876269731355b47d67311d0b5c20d0f5367eeffffffff0150c300000000000047522102767b0a5e739a6c2753208df001f457197244a857539cb4354e0ea2cbb1b73a512103ef0852f047e8509170551c17c81a73d28cc6dead08f3738b3611d5a67533ebd052ae00000000",
    //   "hex"
    // ),
    nonWitnessUtxo: Buffer.from(
      "02000000000101f1cf408eaccd9b2dc391d85a6944860ab076045b49f352195aba79d576282c000100000000ffffffff0210270000000000001600145689ee564e8e3b3d9228d47cb9f7c008dedca262bf642501000000001600141f8de200a822f289cd33d1025858a8359704f8ab0248304502210081e46683ff7ace83ee0ace4ef15444842bb2e65dda256ddc8b6b2d4ea04774f402201f086243f86a73687529d615c08acd99fd8bb64c1ecea9c5569edb12bb6d2bee012103cd16b7408fb30cbce026b7dab56c6991c9fa42a477e72cae43da3d3f53474bfd00000000",
      "hex"
    ),
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
  //const tx = psbt.extractTransaction();
  // console.log(tx.toHex());

  const txHex = psbt.extractTransaction().toHex();

  console.log("tx to broadcast: ");
  console.log(txHex);

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
