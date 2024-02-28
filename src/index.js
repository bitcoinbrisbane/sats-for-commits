const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.post("/issue", async (req, res) => {
  // Octokit.js
  // https://github.com/octokit/core.js#readme
  const octokit = new Octokit({
    auth: "YOUR-TOKEN",
  });

  await octokit.request("GET /issues", {
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  await octokit.request("PATCH /repos/{owner}/{repo}/issues/{issue_number}", {
    // owner: "OWNER",
    // repo: "REPO",
    // issue_number: "ISSUE_NUMBER",
    // title: "Found a bug",
    body: "This issues tip jar is bc1qsaasrcqamcm96p0v3m46dne9d6hesuzm60hz3z",
    // assignees: ["octocat"],
    milestone: 1,
    state: "open",
    labels: ["fund"],
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
