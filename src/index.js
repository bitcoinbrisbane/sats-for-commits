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

const { testnet } = require("bitcoinjs-lib/src/networks");
const { getBalance, getMnemonic, sendFromTreasury } = require("./utils");

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

const getIssueAmount = (issue_type) => {
  if (issue_type === "bug") {
    return 1000;
  }
  if (issue_type === "documentation") {
    return 500;
  }

  return 100;
};

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

app.get("/treasury/:id/balance", async (req, res) => {
  const id = req.params.id;
  const treasury = getRepoAddress(id);
  const balanceResponse = await getBalance(treasury);
  res.status(200).send(balanceResponse);
});

app.post("/tip", async (req, res) => {
  const balanceResponse = await getBalance(
    "tb1q9vt02j39x6tekclatwgcw6d935xvlz3qkt0kwk"
  );

  // await sendTip(req.body.from, req.body.to, req.body.amount);
  res.status(200).send(balanceResponse);
});

app.post("/", async (req, res) => {
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
    // const issue_id = req.body?.issue.number;
    // await addAssignedUserToIssue(
    //   repo_id,
    //   full_name,
    //   issue_id,
    //   req.body?.assignee?.id
    // );
    // return;
  }

  console.table(req.body?.issue?.labels);

  // Fund open bug issues
  if (req.body?.action === "labeled" && req.body?.issue?.state === "open") {
    const full_name = req.body?.repository?.full_name;
    const repo_id = req.body?.repository?.id;
    const issue_id = req.body?.issue.number;

    const amount = getIssueAmount(req.body?.label?.name);
    const txid = await fundIssue(repo_id, full_name, issue_id, amount);

    if (txid === undefined) {
      res.status(500).send("Issue funding failed");
      return;
    }

    res.status(200).send(`Issue funded with ${amount} sats.  TX: ${txid}`);
    return;
  }

  if (req.body?.issue && req.body?.action === "opened") {
    console.log("Adding tip jar address");

    const full_name = req.body?.repository?.full_name;
    const repo_id = req.body?.repository?.id;
    const issue_id = req.body?.issue.number;

    await addTipJarToIssue(repo_id, full_name, issue_id);

    res.status(200).send("Tip address added to issue");
    return;
  }

  // if (req.body?.issue && req.body?.action === "closed") {
  //   console.log("Refunding any bounty to the repository treasury");
  //   const full_name = req.body?.repository?.full_name;
  //   const repo_id = req.body?.repository?.id;
  //   const issue_id = req.body?.issue.number;

  //   await refundingIssue(repo_id, full_name, issue_id);

  //   res.status(200).send("Issue refunded");
  //   return;
  // }

  if (
    req.body?.pull_request &&
    req.body?.action === "closed" &&
    req.body?.pull_request?.merged === true
  ) {
    console.log("merged " + req.body?.pull_request?.id);

    const assignee_id = req.body?.pull_request?.assignee?.id;

    const txid = await fundIssue(repo_id, full_name, issue_id, amount);

    if (txid === undefined) {
      res.status(500).send("Issue funding failed");
      return;
    }

    res
      .status(200)
      .send(`PR closed and bounty sent to assignee with TX: ${txid}`);
    return;
  }
});

const fundIssue = async (repo_id, full_name, issue_id, amount) => {
  const issueAddress = getIssueAddress(repo_id, issue_id);
  const txid = await sendFromTreasury(repo_id, amount, issueAddress);

  if (txid === undefined) {
    return;
  }

  const octokit = createOctokit();

  await octokit.request(
    `POST /repos/${full_name}/issues/${issue_id}/comments`,
    {
      body: `Adding ${amount} sats to the bug bounty. The TX hash is ${txid} https://live.blockcypher.com/btc-testnet/tx/${txid}/`,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  return txid;
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

  const balanceResponse = await getBalance(address);
  if (balanceResponse?.amount === 0) {
    return;
  }

  // const treasury = getRepoAddress(repo_id);
  // const txid = await sendTip(
  //   repo_id,
  //   address,
  //   treasury,
  //   balanceResponse.amount
  // );

  // await octokit.request(`POST /repos/${full_name}/issues/${issue}/comments`, {
  //   body: `Refunding btc back to the treasury ${treasury} from the tip jar ${address}. The TX hash is ${txid}`,
  //   headers: {
  //     "X-GitHub-Api-Version": "2022-11-28",
  //   },
  // });
};

// Send a tip from the issues address to GH user
const payBounty = async (full_name, pr, assignee_id) => {
  const assigneeAddress = getUserAddress(repo_id, assignee_id);
  const txid = await sendFromTreasury(repo_id, amount, assigneeAddress);

  if (txid === undefined) {
    return;
  }

  const octokit = await createOctokit();
  const message = `This PR has been closed and the tip jar address has been sent to ${assignee}`;

  // Add to PR comment
  await octokit.request(`POST /repos/${full_name}/issues/${pr}/comments`, {
    body: `This PR has been closed and the tip jar address has been emptied.`,
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
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

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
