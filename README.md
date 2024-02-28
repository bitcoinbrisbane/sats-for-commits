# sats-for-commits
Sats for commits allows project owners to add bitcoin bounties on their issues.

## Setup

* Allow GitHub issues
* Add expub key to GitHub settings

## Workflow

### Creating the issue

When a project owner creates a new issue, the issue is given a sequential integer as its id.  EG `https://github.com/bitcoinbrisbane/sats-for-commits/issues/1`.  This ID will for the HD address for the issue, and add the address to the issue via the PATCH route.

Path: `m/84'/0'/0'/0/1`
Address: `bc1qsaasrcqamcm96p0v3m46dne9d6hesuzm60hz3z`

The following text is added to the bottom of the issue, allow with the tags "btc".

```text
This issues tipjar is bc1qsaasrcqamcm96p0v3m46dne9d6hesuzm60hz3z
```
![Example of issue #1](image.png)

### Fund a project

Projects and be fundend globally, or per issue.

### Funding the issue

A service with a webhook monitors the address for incoming transactions.  When a transaction is detected, the service adds the amount to the issues comments.

If the project is funded, the amount of sats per issue can be calculated by the issue label.  For example, issues with a "good first issue label" could have a bounty of 1000 sats.


### Claiming the bounty


## Matching GPG keys to GitHub users

## Test vectors

`year define slow hunt miss awake boil wrist sadness sail speak bench`

* zprvAcVNoVY3JwpXpEerADLkrqDY4jjgYpswM9SiXfBd5GR2G3XoTkp6VJFFsExewcu7o4GfwsmV3BXakWTVgs8jdxbbmSuQeWj6pbeSnQ8a4gQ
* zpub6qUjD14w9KNq2ijKGEsmDyAGcmaAxHbniNNKL3bEdbx18qrx1J8M36ZjiWVyTbhRJ5cUJWmLVhDZiJSfgQExEeaLpHosXbfWiPDoornsrmT
