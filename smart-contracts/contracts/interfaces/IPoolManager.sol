// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

interface IPoolManager {
    function getProtocolFeeBps() external view returns (uint256);
    function getFeeDenominator() external view returns (uint256);
    function receiveProtocolFee() external payable;
    function getRouterAddress() external view returns (address);
}
