// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.4;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title NFT
 * @dev A contract for creating and managing ERC721 non-fungible tokens (NFTs).
 */
contract NFT is Ownable, ERC721 {
    /**
     * @dev The maximum token ID that has been minted.
     */
    uint256 public tokenIdMax;

    /**
     * @dev Mapping from token ID to its associated URI.
     */
    mapping(uint256 tokenId => string tokenURI) private _tokenURI;

    /**
     * @dev Initializes the OpenZeppelin ERC721 contract with a name and symbol.
     */
    // solhint-disable-next-line no-empty-blocks
    constructor() ERC721("NFT Token", "NFT") {}

    /**
     * @notice Mints a new NFT and assigns it to the specified address.
     * @param to The address to which the NFT will be minted.
     * @param tokenURI_ The URI for the newly minted NFT.
     * @dev Only the contract owner can mint NFTs.
     */
    function mint(address to, string calldata tokenURI_) external onlyOwner {
        _mint(to, ++tokenIdMax);
        _tokenURI[tokenIdMax] = tokenURI_;
    }

    /**
     * @notice Returns the URI for a specific NFT.
     * @param tokenId The ID of the NFT for which the URI is requested.
     * @return The URI of the specified NFT.
     * @dev This function overrides the ERC721 implementation.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireMinted(tokenId);
        return _tokenURI[tokenId];
    }

    /**
     * @dev Checks if the spender is approved to manage the specified NFT.
     * @param spender The address of the spender.
     * @param tokenId The ID of the NFT.
     * @return True if the spender is approved or the owner of the NFT; otherwise, false.
     * @dev This function overrides the ERC721 implementation.
     */
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view override returns (bool) {
        address tokenOwner = ERC721.ownerOf(tokenId);
        return (spender == owner() ||
            spender == tokenOwner ||
            isApprovedForAll(tokenOwner, spender) ||
            getApproved(tokenId) == spender);
    }
}
