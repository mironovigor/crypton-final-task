# NFTAuction Contract

NFTAuction is a Solidity smart contract designed for creating, listing, and auctioning Non-Fungible Tokens (NFTs). This
contract allows artists to mint NFTs, list them for sale, and auction them to the highest bidder. It supports both
native currency and ERC-20 tokens as payment options.

## Features

- **Artist Role**: The contract has a role-based access control system, allowing only users with the "Artist Role" to
  create NFTs.

- **Listing for Sale**: Artists can list their NFTs for sale at a specified price. Ownership of the NFT is transferred
  to the contract during the listing.

- **Buying NFTs**: Users can purchase NFTs that are listed for sale. Payment can be made using either native currency or
  a specified ERC-20 token.

- **Canceling Listings**: The owner of an NFT can cancel a listing if it's no longer for sale.

- **Listing for Auction**: Artists can list their NFTs for auction, specifying the starting price, minimum bid
  increment, and duration of the auction.

- **Bidding on NFTs**: Users can place bids on NFTs listed for auction, with the highest bidder winning the NFT after
  the auction ends.

- **Finishing Auctions**: After an auction ends, the owner can finalize the auction, transferring the NFT to the highest
  bidder and receiving the payment.

- **Canceling Auctions**: The owner can cancel an auction before it ends, returning the NFT to themself.

## Usage

### Pre Requisites

Before being able to run any command, you need to create a `.env` file and set a BIP-39 compatible mnemonic as an
environment variable. You can follow the example in `.env.example`. If you don't already have a mnemonic, you can use
this [website](https://iancoleman.io/bip39/) to generate one.

Then, proceed with installing dependencies:

```sh
$ pnpm install
```

### Compile

Compile the smart contracts with Hardhat:

```sh
$ pnpm compile
```

### TypeChain

Compile the smart contracts and generate TypeChain bindings:

```sh
$ pnpm typechain
```

### Test

Run the tests with Hardhat:

```sh
$ pnpm test
```

### Lint Solidity

Lint the Solidity code:

```sh
$ pnpm lint:sol
```

### Lint TypeScript

Lint the TypeScript code:

```sh
$ pnpm lint:ts
```

### Coverage

Generate the code coverage report:

```sh
$ pnpm coverage
```

### Report Gas

See the gas usage per unit test and average gas per method call:

```sh
$ REPORT_GAS=true pnpm test
```

### Clean

Delete the smart contract artifacts, the coverage reports and the Hardhat cache:

```sh
$ pnpm clean
```

### Deploy

Deploy the contracts to Hardhat Network:

```sh
$ pnpm deploy:contracts
```

### Tasks

#### Deploy NFTAuction

Deploy a new instance of the NFTAuction contract via a task:

```sh
$ pnpm task:deployNFTAuction --network ganache
```

## Tips

### Syntax Highlighting

If you use VSCode, you can get Solidity syntax highlighting with the
[hardhat-solidity](https://marketplace.visualstudio.com/items?itemName=NomicFoundation.hardhat-solidity) extension.

## Using GitPod

[GitPod](https://www.gitpod.io/) is an open-source developer platform for remote development.

To view the coverage report generated by `pnpm coverage`, just click `Go Live` from the status bar to turn the server
on/off.

## Local development with Ganache

### Install Ganache

```sh
$ npm i -g ganache
```

### Run a Development Blockchain

```sh
$ ganache -s test
```

> The `-s test` passes a seed to the local chain and makes it deterministic

Make sure to set the mnemonic in your `.env` file to that of the instance running with Ganache.

## License

This project is licensed under MIT.
