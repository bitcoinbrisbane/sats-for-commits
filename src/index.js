const express = require("express");
const app = express();
const { Octokit, App } = require("octokit");
const { createAppAuth } = require("@octokit/auth-app");
const fs = require("fs");
const { BIP32Factory } = require("bip32");
const ecc = require("tiny-secp256k1");
const bip32 = BIP32Factory(ecc);
const bip39 = require("bip39");
const bitcoin = require("bitcoinjs-lib");
const CryptoAccount = require("send-crypto");
const { testnet } = require("bitcoinjs-lib/src/networks");
const axios = require("axios");

// load dotenv
require("dotenv").config();

const network = bitcoin.networks.testnet;

// add json middleware
app.use(express.json());

app.get("/", (req, res) => {
  res.send("To da moon! 🚀🌕");
});

app.get("/api", (req, res) => {
  res.send("To da moon! 🚀🌕");
});

const createOctokit = () => {
  const privateKey = fs.readFileSync("src/private-key.pem", "utf-8");

  // Octokit.js
  // https://github.com/octokit/core.js#readme
  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: process.env.APP_ID,
      privateKey: privateKey,
      installationId: process.env.INSTALLATION_ID,
    },
  });

  return octokit;
};

app.post("/api", async (req, res) => {
  console.log(req.body);

  if (
    req.body?.action === "closed" &&
    req.body?.pull_request?.merged === true
  ) {
    return;
  }

  if (req.body?.repository?.id === undefined) {
    res.status(500).send("Repository ID is required");
    return;
  }

  if (req.body?.repository?.id > 4294967296) {
    res.status(500).send("Repository ID too big");
    return;
  }

  if (req.body?.action === "assigned") {
    const full_name = req.body?.repository?.full_name;
    const repo_id = req.body?.repository?.id;
    const issue = req.body?.issue.number;
    await addAssignedUserToIssue(
      repo_id,
      full_name,
      issue,
      req.body?.assignee?.id
    );
    return;
  }

  console.table(req.body?.issue?.labels);

  // Fund open bug issues
  if (req.body?.issue?.labels?.find((label) => label.name === "bug") && req.body?.issue?.state === "open") {
    console.log("Adding bug bounty address");
    const full_name = req.body?.repository?.full_name;
    const repo_id = req.body?.repository?.id;
    const issue = req.body?.issue.number;
    await addBountyToIssue(repo_id, full_name, issue);
    res.status(200).send("Issue patched");
    return;
  }

  if (req.body?.issue && req.body?.action === "opened") {
    console.log("Adding tip jar address");
    const full_name = req.body?.repository?.full_name;
    const repo_id = req.body?.repository?.id;
    const issue = req.body?.issue.number;

    await addTipJarToIssue(repo_id, full_name, issue);

    res.status(200).send("Issue patched");
    return;
  }

  if (req.body?.issue && req.body?.action === "closed") {
    console.log("Refunding any bounty to the treasury");
    const full_name = req.body?.repository?.full_name;
    const repo_id = req.body?.repository?.id;
    const issue = req.body?.issue.number;

    await refundingIssue(repo_id, full_name, issue);

    res.status(200).send("Issue patched");
    return;
  }

  if (req.body?.pull_request) {
    console.log("Closing PR and emptying tip jar");
    const full_name = req.body?.repository?.full_name;
    const pr = req.body?.pull_request.number;

    await closePR(full_name, pr);

    res.status(200).send("PR closed");
    return;
  }
});

const addBountyToIssue = async (repo_id, full_name, issue) => {
  const octokit = createOctokit();
  const treasury = getRepoAddress(repo_id);
  const address = getIssueAddress(repo_id, issue);

  const txid = await sendTip(repo_id, treasury, address, 1000);

  if (txid === undefined) {
    return;
  }

  await octokit.request(`POST /repos/${full_name}/issues/${issue}/comments`, {
    body: `Adding 1,000 sats to the bug bounty. The TX hash is ${txid}`,
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
};

const addAssignedUserToIssue = async (full_name, issue, user_id) => {
  const octokit = createOctokit();
  const address = geUserAddress(user_id);

  await octokit.request(`POST /repos/${full_name}/issues/${issue}/comments`, {
    body: `The assigned users btc address is ${address}`,
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
};

const addTipJarToIssue = async (repo_id, full_name, issue) => {
  const octokit = createOctokit();
  const address = getIssueAddress(repo_id, issue);

  await octokit.request(`POST /repos/${full_name}/issues/${issue}/comments`, {
    body: `This issue's unique tip jar address is ${address}`,
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
};

const refundingIssue = async (repo_id, full_name, issue) => {
  const octokit = createOctokit();
  const address = getIssueAddress(repo_id, issue);
  const treasury = getRepoAddress(repo_id);

  await octokit.request(`POST /repos/${full_name}/issues/${issue}/comments`, {
    body: `Refunding btc back to the treasury ${treasury}`,
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
};

// Send a tip from the issues address to GH user
const closePR = async (full_name, pr) => {
  const octokit = await createOctokit();
  const message = `This PR has been closed and the tip jar address has been emptied.`;

  // Add to PR comment
  await octokit.request(`POST /repos/${full_name}/issues/${pr}/comments`, {
    body: `This PR has been closed and the tip jar address has been emptied.`,
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  await octokit.request(`PATCH /repos/${full_name}/pulls/${pr}`, {
    state: "closed",
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
};

// Note, change will go to the treasury address or the user's address
const geUserAddress = (user_id) => {
  const coin = network === bitcoin.networks.testnet ? "1" : "0";
  const path = `m/44'/${coin}'/0'/0/0/${user_id}`;
  const mnemonic =
    process.env.MNEMONIC ||
    "praise you muffin lion enable neck grocery crumble super myself license ghost";
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, network);
  const child = root.derivePath(path);
  const address = bitcoin.payments.p2wpkh({
    pubkey: child.publicKey,
    network: network,
  });
  return address.address;
};

// Repo treasury address
const getRepoAddress = (repo_id) => {
  const coin = network === bitcoin.networks.testnet ? "1" : "0";
  const path = `m/44'/${coin}'/0'/0/${repo_id}/0`;
  const mnemonic =
    process.env.MNEMONIC ||
    "praise you muffin lion enable neck grocery crumble super myself license ghost";
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, network);
  const child = root.derivePath(path);
  const address = bitcoin.payments.p2wpkh({
    pubkey: child.publicKey,
    network: network,
  });
  return address.address;
};

const getIssueAddress = (repo_id, issue_id) => {
  const coin = network === bitcoin.networks.testnet ? "1" : "0";
  const path = `m/44'/${coin}'/0'/0/${repo_id}/${issue_id}`;
  const mnemonic =
    process.env.MNEMONIC ||
    "praise you muffin lion enable neck grocery crumble super myself license ghost";
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, network);
  const child = root.derivePath(path);
  const address = bitcoin.payments.p2wpkh({
    pubkey: child.publicKey,
    network: network,
  });
  return address.address;
};

const sendTip = async (repo_id, from, to, amount) => {
  const treasury = getRepoAddress(repo_id);
  console.log(treasury);

  const coin = network === bitcoin.networks.testnet ? "1" : "0";
  const path = `m/44'/${coin}'/0'/0/${repo_id}/0`;
  const mnemonic =
    process.env.MNEMONIC ||
    "praise you muffin lion enable neck grocery crumble super myself license ghost";
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, network);
  const child = root.derivePath(path);
  const privateKeyBuffer = child.privateKey;

  const psbt = new bitcoin.Psbt();
  const unspent = await getUnspent(from);

  if (unspent === undefined) {
    return;
  }

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
  // const txb = new bitcoin.TransactionBuilder(network);
  // const unspent = await getUnspent(from);

  // if (unspent === undefined) {
  //   return;
  // }

  // const tx = txb.addInput(unspent.txid, unspent.vout);
  // txb.addOutput(to, amount);
  // txb.sign(0, keyPair);
  // const txHex = txb.build().toHex();
  // const txid = await broadcast(txHex);
  // return txid;
};

const getUnspent = async (address) => {
  const response = await axios.get(
    `https://api.blockcypher.com/v1/btc/test3/addrs/${address}?unspentOnly=true`
  );
  const unspent = response.data.txrefs[0];
  return unspent;
};

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
