// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title PoolManagerProxy
 * @dev This contract is a proxy that delegates all calls to the PoolManager implementation.
 * It uses the ERC1967 proxy pattern for upgradeability.
 */
contract PoolManagerProxy is ERC1967Proxy {
    /**
     * @dev Initializes the proxy with the implementation address and initialization data
     * @param _implementation The address of the PoolManager implementation contract
     * @param _data The initialization data to be passed to the implementation
     */
    constructor(address _implementation, bytes memory _data) ERC1967Proxy(_implementation, _data) {}
} 
