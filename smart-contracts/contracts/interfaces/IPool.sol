// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Presale} from "./IPresale.sol";


struct Stats {
    uint256 totalContributed;
    uint256 totalTokenAmount;
    uint256 totalClaimed;
    bool isFinalized;
}

interface IPool {
    function initialize(address _owner) external returns (bool);

    function setPresale(Presale memory saleInfo) external returns (uint256);

    function getPoolData()
        external
        view
        returns (Presale memory);

    function _presaleStats() external view returns (Stats memory);
}
