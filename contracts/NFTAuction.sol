// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.4;

import { NFT } from "./NFT.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title NFTAuction
 * @dev A contract for creating, listing, and auctioning NFTs.
 */
contract NFTAuction is ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;

    /**
     * @dev The role identifier for artists who can create NFTs.
     */
    bytes32 public constant ARTIST_ROLE = keccak256("Artist Role");

    /**
     * @dev The duration for which an auction is active (3 days).
     */
    uint256 public constant AUCTION_DURATION = 3 days;

    /**
     * @dev The duration for which an auction bid can be prolonged (5 min).
     */
    uint256 public constant AUCTION_PROLONGED = 5 minutes;

    /**
     * @dev An immutable reference to the NFT contract.
     */
    NFT public immutable nftToken;

    /**
     * @dev Mapping of token IDs to their respective listings.
     */
    mapping(uint256 tokenId => Listing listing) public listings;

    /**
     * @dev Mapping of token IDs to their respective auctions.
     */
    mapping(uint256 tokenId => Auction auction) public auctions;

    /**
     * @notice Initializes the NFTAuction contract.
     * @dev Deploys new associated NFT contract.
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        nftToken = new NFT();
    }

    /**
     * @notice Creates a new NFT.
     * @param _tokenURI The URI for the new NFT.
     * @dev Only users with the "Artist Role" can create NFTs.
     */
    function createItem(string memory _tokenURI) external onlyRole(ARTIST_ROLE) {
        nftToken.mint(msg.sender, _tokenURI);
    }

    /**
     * @notice Lists an NFT for sale.
     * @param _tokenId The ID of the NFT to list.
     * @param _price The sale price of the NFT.
     * @param _token The address of the payment token (use address(0) for native currency).
     * @dev This function transfers the ownership of the NFT to this contract while it's listed for sale.
     */
    function listItem(uint256 _tokenId, uint256 _price, address _token) external {
        if (_price == 0) revert PriceIsZero();
        nftToken.transferFrom(msg.sender, address(this), _tokenId);
        listings[_tokenId] = Listing(payable(msg.sender), _price, _token);
    }

    /**
     * @notice Buys an NFT listed for sale.
     * @param _tokenId The ID of the NFT to purchase.
     * @dev The payment should be made in currency specified in the auction.
     */
    function buyItem(uint256 _tokenId) external payable nonReentrant {
        Listing storage listing = listings[_tokenId];
        if (listing.price == 0) revert NoSuchListing();
        if (listing.token == address(0)) {
            if (listing.price > msg.value) revert ValueLessThanPrice();
            listing.artist.transfer(msg.value);
        } else {
            IERC20(listing.token).safeTransferFrom(msg.sender, listing.artist, listing.price);
        }
        nftToken.transferFrom(address(this), msg.sender, _tokenId);
        delete listings[_tokenId];
    }

    /**
     * @notice Cancels a listing of an NFT.
     * @param _tokenId The ID of the NFT to cancel.
     * @dev Only the owner of the NFT can cancel the listing.
     */
    function cancel(uint256 _tokenId) external {
        Listing storage listing = listings[_tokenId];
        if (listing.artist != msg.sender) revert Unauthorized();
        nftToken.transferFrom(address(this), listing.artist, _tokenId);
        delete listings[_tokenId];
    }

    /**
     * @notice Lists an NFT for auction.
     * @param _tokenId The ID of the NFT to list.
     * @param _price The starting price of the auction.
     * @param _step The minimum bid increment for the auction.
     * @param _token The address of the payment token (use address(0) for native currency).
     * @dev This function transfers the ownership of the NFT to this contract while it's listed for auction.
     */
    function listOnAuction(uint256 _tokenId, uint256 _price, uint256 _step, address _token) external {
        if (_price == 0) revert PriceIsZero();
        nftToken.transferFrom(msg.sender, address(this), _tokenId);
        listings[_tokenId] = Listing(payable(msg.sender), _price, _token);
        auctions[_tokenId] = Auction(
            payable(msg.sender),
            _price,
            _step,
            _token,
            block.timestamp + AUCTION_DURATION,
            _price,
            0,
            payable(address(0))
        );
    }

    /**
     * @notice Places a bid on an NFT auction.
     * @param _tokenId The ID of the NFT auction.
     * @param _bid The bid amount.
     * @dev The bid must be greater than the current highest bid plus the bid increment.
     * @dev The payment can be made in either native currency or a specified ERC20 token.
     */
    function makeBid(uint256 _tokenId, uint256 _bid) external payable nonReentrant {
        Auction storage auction = auctions[_tokenId];
        if (auction.priceMin == 0) revert NoSuchAuction();

        if (block.timestamp > auction.timeEnd) revert AuctionExpired();
        if (_bid < auction.priceCurrent + auction.step) revert BidLessThanStep();
        if (auction.token == address(0)) {
            if (_bid > msg.value) revert ValueLessThanBid();
        } else {
            IERC20(auction.token).safeTransferFrom(msg.sender, address(this), _bid);
        }
        if (auction.bids > 0) {
            if (auction.token == address(0)) {
                auction.lastMaxBidder.transfer(auction.priceCurrent);
            } else {
                IERC20(auction.token).safeTransfer(auction.lastMaxBidder, auction.priceCurrent);
            }
        }
        uint256 timeAdded = block.timestamp + AUCTION_PROLONGED;
        if (auction.timeEnd < timeAdded) {
            auction.timeEnd = timeAdded;
        }

        auction.lastMaxBidder = payable(msg.sender);
        auction.priceCurrent = _bid;
        auction.bids++;
    }

    /**
     * @notice Finishes an NFT auction.
     * @param _tokenId The ID of the NFT auction.
     * @dev Only the owner of the NFT auction can finish it, and only after the auction has ended.
     */
    function finishAuction(uint256 _tokenId) external nonReentrant {
        Auction storage auction = auctions[_tokenId];
        if (auction.artist != msg.sender && auction.timeEnd > block.timestamp) revert AuctionNotExpired();

        if (auction.bids >= 2) {
            nftToken.transferFrom(address(this), auction.lastMaxBidder, _tokenId);
            if (auction.token == address(0)) {
                payable(msg.sender).transfer(auction.priceCurrent);
            } else {
                IERC20(auction.token).safeTransfer(msg.sender, auction.priceCurrent);
            }
        } else {
            nftToken.transferFrom(address(this), auction.artist, _tokenId);
            if (auction.bids > 0) {
                if (auction.token == address(0)) {
                    auction.lastMaxBidder.transfer(auction.priceCurrent);
                } else {
                    IERC20(auction.token).safeTransfer(auction.lastMaxBidder, auction.priceCurrent);
                }
            }
        }
        delete auctions[_tokenId];
    }

    /**
     * @notice Cancels an NFT auction.
     * @param _tokenId The ID of the NFT auction.
     * @dev Only the owner of the NFT auction can cancel it, and only before the auction ends.
     */
    function cancelAuction(uint256 _tokenId) external nonReentrant {
        Auction storage auction = auctions[_tokenId];
        if (auction.artist != msg.sender) revert Unauthorized();
        if (block.timestamp > auction.timeEnd) revert AuctionExpired();
        nftToken.transferFrom(address(this), msg.sender, _tokenId);
        if (auction.bids > 0) {
            if (auction.token == address(0)) {
                auction.lastMaxBidder.transfer(auction.priceCurrent);
            } else {
                IERC20(auction.token).safeTransfer(auction.lastMaxBidder, auction.priceCurrent);
            }
        }
        delete auctions[_tokenId];
    }

    /**
     * @dev Struct to represent a listing.
     */
    struct Listing {
        address payable artist;
        uint256 price;
        address token;
    }

    /**
     * @dev Struct to represent an auction.
     */
    struct Auction {
        address payable artist;
        uint256 priceMin;
        uint256 step;
        address token;
        uint256 timeEnd;
        uint256 priceCurrent;
        uint256 bids;
        address payable lastMaxBidder;
    }

    /**
     * @dev Custom error to indicate that the price is zero.
     */
    error PriceIsZero();

    /**
     * @dev Custom error to indicate that there is no such listing.
     */
    error NoSuchListing();

    /**
     * @dev Custom error to indicate that there is no such auction.
     */
    error NoSuchAuction();

    /**
     * @dev Custom error to indicate that the bid is less than the step.
     */
    error BidLessThanStep();

    /**
     * @dev Custom error to indicate that the value is less than the price.
     */
    error ValueLessThanPrice();

    /**
     * @dev Custom error to indicate that the value is less than the bid.
     */
    error ValueLessThanBid();

    /**
     * @dev Custom error to indicate an unauthorized action.
     */
    error Unauthorized();

    /**
     * @dev Custom error to indicate that the auction has expired.
     */
    error AuctionExpired();

    /**
     * @dev Custom error to indicate that the auction is not yet expired.
     */
    error AuctionNotExpired();
}
