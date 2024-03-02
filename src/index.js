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

// load dotenv
require("dotenv").config();

// add json middleware
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.get("/api", (req, res) => {
  res.send("Hello API World");
});

app.post("/api", async (req, res) => {
  // if (req.body?.action !== "opened") {
  //   return;
  // }

  if (req.body?.repository?.id === undefined) {
    res.status(500).send("Repository ID is required");
    return;
  }

  if (req.body?.repository?.id > 4294967296) {
    res.status(500).send("Repository ID too big");
    return;
  }

  // 4294967296
  console.log(req.body);
  console.table(req.body?.issue?.labels);

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

  const full_name = req.body?.repository?.full_name;
  const issue = req.body?.issue.number;

  const address = createIssueAddress(
    req.body?.repository?.id,
    req.body?.issue.number
  );

  await octokit.request(`PATCH /repos/${full_name}/issues/${issue}`, {
    body: `This issue's tip jar address is ${address}`,
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
});

const createIssueAddress = (repo_id, issue_id) => {
  const path = `m/44'/0'/0'/0/${repo_id}/${issue_id}`;
  const mnemonic =
    process.env.MNEMONIC ||
    "praise you muffin lion enable neck grocery crumble super myself license ghost";
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, bitcoin.networks.mainnet);
  const child = root.derivePath(path);
  const address = bitcoin.payments.p2wpkh({
    pubkey: child.publicKey,
  });
  return address.address;
};

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
