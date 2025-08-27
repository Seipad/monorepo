// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

struct Presale {
    address token;
    uint256 presaleRate;
    uint256 softcap;
    uint256 hardcap;
    uint256 liquidityRate; // x
    uint256 listingRate;
    uint256 startTime;
    uint256 endTime;
    bool refund; // x
    string tokenName;
    string tokenSymbol;
}

struct Contributor {
    uint256 totalContributed;
    uint256 claimable;
    uint256 claimed;
}
