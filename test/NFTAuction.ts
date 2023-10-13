import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { BigNumberish, ZeroAddress, toBigInt } from "ethers";
import { ethers } from "hardhat";

import type { ERC20mock } from "../types/contracts/ERC20mock";
import type { NFT } from "../types/contracts/NFT";
import type { NFTAuction } from "../types/contracts/NFTAuction";

describe("NFT Auction", function () {
  let nftAuction: NFTAuction, nftAuctionAddress: string;
  let nftToken: NFT;
  let erc20Mock: ERC20mock, erc20MockAddress: string;
  let owner: HardhatEthersSigner,
    artist1: HardhatEthersSigner,
    artist2: HardhatEthersSigner,
    user1: HardhatEthersSigner,
    user2: HardhatEthersSigner;
  const tokenURI = "https://example.com/token/1";

  beforeEach(async function () {
    [owner, artist1, artist2, user1, user2] = await ethers.getSigners();

    const nftAuctionFactory = await ethers.getContractFactory("NFTAuction");
    nftAuction = await nftAuctionFactory.connect(owner).deploy();
    await nftAuction.waitForDeployment();
    nftAuctionAddress = await nftAuction.getAddress();

    const nftTokenAddress = await nftAuction.nftToken();
    nftToken = await ethers.getContractAt("NFT", nftTokenAddress);

    const artistRole: string = await nftAuction.ARTIST_ROLE();
    await nftAuction.grantRole(artistRole, artist1.address);
    await nftAuction.grantRole(artistRole, artist2.address);

    const ERC20mock = await ethers.getContractFactory("ERC20mock");
    erc20Mock = await ERC20mock.connect(owner).deploy();
    await erc20Mock.waitForDeployment();
    erc20MockAddress = await erc20Mock.getAddress();
  });

  it("user without ARTIST_ROLE cannot create an item", async function () {
    await expect(nftAuction.connect(user1).createItem(tokenURI)).to.be.reverted;
  });

  async function _createItem(artist: HardhatEthersSigner) {
    await nftAuction.connect(artist).createItem(tokenURI);
    return await nftToken.tokenIdMax();
  }

  async function _makeBid(
    user: HardhatEthersSigner,
    nftTokenId: BigNumberish,
    tokenAddress: string,
    value: BigNumberish | number,
  ) {
    const _value: bigint = toBigInt(value.toString());

    const auctionBefore = await nftAuction.auctions(nftTokenId);
    const accounts: string[] = [auctionBefore.lastMaxBidder, user.address, nftAuctionAddress];
    const balances: bigint[] =
      auctionBefore.bids > 0
        ? [auctionBefore.priceCurrent, -_value, _value - toBigInt(auctionBefore.priceCurrent)]
        : [toBigInt(0), -_value, _value];

    if (tokenAddress === erc20MockAddress) {
      await erc20Mock.transfer(user.address, _value);
      await erc20Mock.connect(user).approve(nftAuctionAddress, _value);
      await expect(nftAuction.connect(user).makeBid(nftTokenId, _value)).to.changeTokenBalances(
        erc20Mock,
        accounts,
        balances,
      );
    } else
      await expect(nftAuction.connect(user).makeBid(nftTokenId, _value, { value: _value })).to.changeEtherBalances(
        accounts,
        balances,
      );

    const auctionAfter = await nftAuction.auctions(nftTokenId);
    expect(auctionAfter.priceCurrent).equal(_value);
    expect(auctionAfter.bids).equal(auctionBefore.bids + toBigInt(1));
    expect(auctionAfter.lastMaxBidder).equal(user.address);
  }

  async function _finishAuction(user: HardhatEthersSigner, nftTokenId: BigNumberish) {
    const auctionBefore = await nftAuction.auctions(nftTokenId);
    const accounts: string[] = [auctionBefore.lastMaxBidder, auctionBefore.artist, nftAuctionAddress];
    const balances: bigint[] =
      auctionBefore.bids > 1
        ? [toBigInt(0), auctionBefore.priceCurrent, -auctionBefore.priceCurrent]
        : [auctionBefore.priceCurrent, toBigInt(0), -auctionBefore.priceCurrent];

    if (auctionBefore.token === erc20MockAddress) {
      await expect(nftAuction.connect(user).finishAuction(nftTokenId)).to.changeTokenBalances(
        erc20Mock,
        accounts,
        balances,
      );
    } else await expect(nftAuction.connect(user).finishAuction(nftTokenId)).to.changeEtherBalances(accounts, balances);

    const nftTokenOwner = auctionBefore.bids > 1 ? auctionBefore.lastMaxBidder : auctionBefore.artist;
    expect(await nftToken.ownerOf(nftTokenId)).to.be.eq(nftTokenOwner);

    const auctionAfter = await nftAuction.auctions(nftTokenId);
    expect(auctionAfter.priceCurrent).equal(0);
  }

  async function _cancelAuction(user: HardhatEthersSigner, nftTokenId: BigNumberish) {
    const auctionBefore = await nftAuction.auctions(nftTokenId); 
    const accounts: string[] = [auctionBefore.lastMaxBidder, auctionBefore.artist, nftAuctionAddress];
    const balances: bigint[] =
        auctionBefore.bids == 0 ? [toBigInt(0), auctionBefore.priceCurrent, -auctionBefore.priceCurrent] :
        auctionBefore.bids > 1
        ? [toBigInt(0), auctionBefore.priceCurrent, -auctionBefore.priceCurrent]
        : [auctionBefore.priceCurrent, toBigInt(0), -auctionBefore.priceCurrent];

    if (auctionBefore.token === erc20MockAddress) {
      await expect(nftAuction.connect(user).cancelAuction(nftTokenId)).to.changeTokenBalances(
        erc20Mock,
        accounts,
        balances,
      );
    } else await expect(nftAuction.connect(user).cancelAuction(nftTokenId)).to.changeEtherBalances(accounts, balances);

    const nftTokenOwner = auctionBefore.bids > 1 ? auctionBefore.lastMaxBidder : auctionBefore.artist;
    expect(await nftToken.ownerOf(nftTokenId)).to.be.eq(nftTokenOwner);

    const auctionAfter = await nftAuction.auctions(nftTokenId);
    expect(auctionAfter.priceCurrent).equal(0);
  }

  it("should createItem() mint a new NFT and assign it to the artist's address", async function () {
    const nftTokenId = await _createItem(artist1);

    expect(nftTokenId).to.equal(1);
    expect(await nftToken.ownerOf(1)).to.equal(artist1.address);
    expect(await nftToken.tokenURI(1)).to.equal(tokenURI);
  });

  it("prevents listing when price is zero or user is not the token owner", async function () {
    await expect(nftAuction.connect(artist1).listItem(1, 1, ZeroAddress)).to.be.revertedWith(
      "ERC721: invalid token ID",
    );
    await expect(nftAuction.connect(artist1).listItem(1, 0, ZeroAddress)).to.be.revertedWithCustomError(
      nftAuction,
      "PriceIsZero()",
    );
    const nftTokenId = await _createItem(artist1);
    await expect(nftAuction.connect(artist2).listItem(nftTokenId, 1, ZeroAddress)).to.be.revertedWith(
      "ERC721: transfer from incorrect owner",
    );
  });

  it("should  listItem()", async function () {
    const nftTokenId = await _createItem(artist1);
    await nftAuction.connect(artist1).listItem(nftTokenId, 1, ZeroAddress);
    const listing = await nftAuction.listings(nftTokenId);
    expect(listing.artist).to.be.equal(artist1.address);
    expect(listing.price).to.be.equal(1);
    expect(listing.token).to.be.equal(ZeroAddress);
    expect(await nftToken.ownerOf(nftTokenId)).to.be.equal(nftAuctionAddress);
  });

  it("prevents buying an item when there is no listing", async function () {
    await expect(nftAuction.connect(user1).buyItem(100)).to.be.revertedWithCustomError(nftAuction, "NoSuchListing()");
  });

  it("prevents buying an item with insufficient value", async function () {
    const nftTokenId = await _createItem(artist1);
    await nftAuction.connect(artist1).listItem(nftTokenId, 10, ZeroAddress);
    await expect(nftAuction.connect(user1).buyItem(nftTokenId, { value: 1 })).to.be.revertedWithCustomError(
      nftAuction,
      "ValueLessThanPrice()",
    );
  });

  it("allows buying an item with native token", async function () {
    const nftTokenId = await _createItem(artist1);
    await nftAuction.connect(artist1).listItem(nftTokenId, 1, ZeroAddress);
    await expect(nftAuction.connect(user1).buyItem(nftTokenId, { value: 1 })).to.changeEtherBalance(artist1.address, 1);
    expect(await nftToken.ownerOf(nftTokenId)).to.be.equal(user1.address);
  });

  it("prevents buying an item with unapproved ERC20 tokens", async function () {
    const nftTokenId = await _createItem(artist1);
    await nftAuction.connect(artist1).listItem(nftTokenId, 10, erc20MockAddress);
    await expect(nftAuction.connect(user1).buyItem(nftTokenId)).to.be.revertedWith("ERC20: insufficient allowance");
  });

  it("allows buying an item with approved ERC20 tokens", async function () {
    const nftTokenId = await _createItem(artist1);
    await nftAuction.connect(artist1).listItem(nftTokenId, 10, erc20MockAddress);
    await erc20Mock.connect(owner).transfer(user1.address, 20);
    await erc20Mock.connect(user1).approve(nftAuctionAddress, 20);

    await expect(nftAuction.connect(user1).buyItem(nftTokenId)).to.changeTokenBalances(
      erc20Mock,
      [artist1.address, user1.address],
      [10, -10],
    );
  });

  it("prevents canceling by an unauthorized user", async function () {
    await expect(nftAuction.connect(user1).cancel(1)).to.be.revertedWithCustomError(nftAuction, "Unauthorized()");
  });

  it("allows canceling by the owner", async function () {
    const nftTokenId = await _createItem(artist1);
    await nftAuction.connect(artist1).listItem(nftTokenId, 10, erc20MockAddress);
    await nftAuction.connect(artist1).cancel(nftTokenId);

    expect(await nftToken.ownerOf(nftTokenId)).to.equal(artist1.address);
    const listing = await nftAuction.listings(nftTokenId);
    expect(listing.price).to.be.equal(0);
  });

  it("prevents listing on auction with invalid parameters", async function () {
    await expect(nftAuction.connect(artist1).listOnAuction(1, 1, 1, ZeroAddress)).to.be.revertedWith(
      "ERC721: invalid token ID",
    );
    await expect(nftAuction.connect(artist1).listOnAuction(1, 0, 1, ZeroAddress)).to.be.revertedWithCustomError(
      nftAuction,
      "PriceIsZero()",
    );
    const nftTokenId = await _createItem(artist1);
    await expect(nftAuction.connect(artist2).listOnAuction(nftTokenId, 1, 1, ZeroAddress)).to.be.revertedWith(
      "ERC721: transfer from incorrect owner",
    );
  });

  it("lists on auction with valid parameters using native token", async function () {
    const nftTokenId = await _createItem(artist1);
    await nftAuction.connect(artist1).listOnAuction(nftTokenId, 1, 2, ZeroAddress);
    const autction = await nftAuction.auctions(nftTokenId);
    expect(autction.artist).to.be.equal(artist1.address);
    expect(autction.priceMin).to.be.equal(1);
    expect(autction.step).to.be.equal(2);
    expect(autction.token).to.be.equal(ZeroAddress);
    expect(autction.timeEnd).to.be.greaterThan(0);
    expect(autction.priceCurrent).to.be.equal(1);
    expect(autction.bids).to.be.equal(0);
    expect(autction.lastMaxBidder).to.be.equal(ZeroAddress);

    expect(await nftToken.ownerOf(nftTokenId)).to.be.equal(nftAuctionAddress);
  });

  it("prevents bidding with invalid parameters", async function () {
    const nftTokenId = await _createItem(artist1);
    await nftAuction.connect(artist1).listOnAuction(nftTokenId, 1, 2, ZeroAddress);
    const auction = await nftAuction.auctions(nftTokenId);

    await expect(nftAuction.connect(user1).makeBid(0, 1)).to.be.revertedWithCustomError(nftAuction, "NoSuchAuction()");
    await expect(nftAuction.connect(user1).makeBid(nftTokenId, 1)).to.be.revertedWithCustomError(
      nftAuction,
      "BidLessThanStep()",
    );
    await expect(nftAuction.connect(user1).makeBid(nftTokenId, 3)).to.be.revertedWithCustomError(
      nftAuction,
      "ValueLessThanBid()",
    );

    await time.increaseTo(auction.timeEnd + BigInt(1));

    await expect(nftAuction.connect(user1).makeBid(nftTokenId, 2)).to.be.revertedWithCustomError(
      nftAuction,
      "AuctionExpired()",
    );
  });

  it("allows bidding for native token", async function () {
    const nftTokenId = await _createItem(artist1);
    await nftAuction.connect(artist1).listOnAuction(nftTokenId, 1, 2, ZeroAddress);

    await _makeBid(user1, nftTokenId, ZeroAddress, 3);
  });

  it("allows bidding for ERC20 token", async function () {
    const nftTokenId = await _createItem(artist1);
    await nftAuction.connect(artist1).listOnAuction(nftTokenId, 1, 2, erc20MockAddress);

    await _makeBid(user1, nftTokenId, erc20MockAddress, 3);
  });

  it("allows prolong bidding", async function () {
    const nftTokenId = await _createItem(artist1);
    await nftAuction.connect(artist1).listOnAuction(nftTokenId, 1, 2, erc20MockAddress);

    const auction = await nftAuction.auctions(nftTokenId);
    let timeEnd = auction.timeEnd;
    await _makeBid(user1, nftTokenId, erc20MockAddress, 3);
    await time.increaseTo(auction.timeEnd - BigInt(20));
    await _makeBid(user2, nftTokenId, erc20MockAddress, 6);
    const auctionAfter = await nftAuction.auctions(nftTokenId);
    expect(auctionAfter.timeEnd).to.be.greaterThan(timeEnd);

  });

  it("prevents finish auction with invalid parameters", async function () {
    const nftTokenId = await _createItem(artist1);
    await nftAuction.connect(artist1).listOnAuction(nftTokenId, 1, 2, ZeroAddress);

    await expect(nftAuction.connect(user1).finishAuction(nftTokenId)).to.be.revertedWithCustomError(
      nftAuction,
      "AuctionNotExpired()",
    );
  });

  it("allows finish auction for native token with 1 bid for artist before expire", async function () {
    const nftTokenId = await _createItem(artist1);
    await nftAuction.connect(artist1).listOnAuction(nftTokenId, 1, 2, ZeroAddress);

    await _makeBid(user1, nftTokenId, ZeroAddress, 3);

    await _finishAuction(artist1, nftTokenId);
  });

  it("allows finish auction for ERC20 token with 1 bid for artist before expire", async function () {
    const nftTokenId = await _createItem(artist1);
    await nftAuction.connect(artist1).listOnAuction(nftTokenId, 1, 2, erc20MockAddress);
    await _makeBid(user1, nftTokenId, erc20MockAddress, 3);

    await _finishAuction(artist1, nftTokenId);
  });

  it("allows finish auction for native token with 2 bids for artist before expire", async function () {
    const nftTokenId = await _createItem(artist1);
    await nftAuction.connect(artist1).listOnAuction(nftTokenId, 1, 2, ZeroAddress);

    await _makeBid(user1, nftTokenId, ZeroAddress, 3);

    await _makeBid(user2, nftTokenId, ZeroAddress, 6);

    await _finishAuction(artist1, nftTokenId);
  });

  it("allows finish auction for ERC20 token with 2 bids for artist before expire", async function () {
    const nftTokenId = await _createItem(artist1);
    await nftAuction.connect(artist1).listOnAuction(nftTokenId, 1, 2, erc20MockAddress);

    await _makeBid(user1, nftTokenId, erc20MockAddress, 3);

    await _makeBid(user2, nftTokenId, erc20MockAddress, 6);

    await _finishAuction(artist1, nftTokenId);
  });

  it("allows finish auction for native token with 2 bids for any user after expire", async function () {
    const nftTokenId = await _createItem(artist1);
    await nftAuction.connect(artist1).listOnAuction(nftTokenId, 1, 2, ZeroAddress);
    const auction = await nftAuction.auctions(nftTokenId);

    await _makeBid(user1, nftTokenId, ZeroAddress, 3);

    await _makeBid(user2, nftTokenId, ZeroAddress, 6);

    await time.increaseTo(auction.timeEnd + BigInt(1));

    await _finishAuction(artist1, nftTokenId);
  });

  it("allows finish auction for ERC20 token with 2 bids for any user after expire", async function () {
    const nftTokenId = await _createItem(artist1);
    await nftAuction.connect(artist1).listOnAuction(nftTokenId, 1, 2, erc20MockAddress);
    const auction = await nftAuction.auctions(nftTokenId);

    await _makeBid(user1, nftTokenId, erc20MockAddress, 3);

    await _makeBid(user2, nftTokenId, erc20MockAddress, 6);

    await time.increaseTo(auction.timeEnd + BigInt(1));

    await _finishAuction(artist1, nftTokenId);
  });

  it("allows finish auction for native token with 1 bids for any user after expire", async function () {
    const nftTokenId = await _createItem(artist1);
    await nftAuction.connect(artist1).listOnAuction(nftTokenId, 1, 2, ZeroAddress);
    const auction = await nftAuction.auctions(nftTokenId);

    await _makeBid(user1, nftTokenId, ZeroAddress, 3);

    await time.increaseTo(auction.timeEnd + BigInt(1));

    await _finishAuction(user1, nftTokenId);
  });

  it("allows finish auction for ERC20 token with 1 bids for any user after expire", async function () {
    const nftTokenId = await _createItem(artist1);
    await nftAuction.connect(artist1).listOnAuction(nftTokenId, 1, 2, erc20MockAddress);
    const auction = await nftAuction.auctions(nftTokenId);

    await _makeBid(user1, nftTokenId, erc20MockAddress, 3);

    await time.increaseTo(auction.timeEnd + BigInt(1));

    await _finishAuction(user1, nftTokenId);
  });

  it("prevents cancel not exists auction", async function () {
    const nftTokenId = await _createItem(artist1);
    await nftAuction.connect(artist1).listOnAuction(nftTokenId, 1, 2, erc20MockAddress);
    await expect(nftAuction.connect(artist1).cancelAuction(2)).to.be.revertedWithCustomError(
      nftAuction,
      "Unauthorized()",
    );
  });

  it("prevents cancel auction for not owner", async function () {
    const nftTokenId = await _createItem(artist1);
    await nftAuction.connect(artist1).listOnAuction(nftTokenId, 1, 2, ZeroAddress);
    await nftAuction.auctions(nftTokenId);
    
    await expect(nftAuction.connect(user1).cancelAuction(nftTokenId)).to.be.revertedWithCustomError(
      nftAuction,
      "Unauthorized()",
    );
  });

  it("prevents cancel auction for owner when auction expired", async function () {
    const nftTokenId = await _createItem(artist1);
    await nftAuction.connect(artist1).listOnAuction(nftTokenId, 1, 2, ZeroAddress);
    const auction = await nftAuction.auctions(nftTokenId);

    await time.increaseTo(auction.timeEnd + BigInt(1));

    await expect(nftAuction.connect(artist1).cancelAuction(nftTokenId)).to.be.revertedWithCustomError(
      nftAuction,
      "AuctionExpired()",
    );
  });

  it("allows cancel auction for native token with bid for artist before expire", async function () {
    const nftTokenId = await _createItem(artist1);
    await nftAuction.connect(artist1).listOnAuction(nftTokenId, 1, 2, ZeroAddress);

    await _makeBid(user1, nftTokenId, ZeroAddress, 3);

    await _cancelAuction(artist1, nftTokenId);
  });

  it("allows cancel auction for ERC20 token with  bid for artist before expire", async function () {
    const nftTokenId = await _createItem(artist1);
    await nftAuction.connect(artist1).listOnAuction(nftTokenId, 1, 2, erc20MockAddress);
    await _makeBid(user1, nftTokenId, erc20MockAddress, 3);

    await _cancelAuction(artist1, nftTokenId);
  });

});
