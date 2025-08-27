// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IPool, Stats} from "../interfaces/IPool.sol";
import {Presale} from "../interfaces/IPresale.sol";
import {IUniswapV2Pair} from "../interfaces/IUniswapV2Pair.sol";
import {CurrencyLibrary} from "../libraries/CurrencyLibrary.sol";
import {DeployableERC20} from "../token/DeployableERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPoolManager} from "../interfaces/IPoolManager.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {Pool} from "./Pool.sol";

contract PoolManager is
    Initializable,
    ReentrancyGuardUpgradeable,
    Ownable2StepUpgradeable,
    UUPSUpgradeable,
    IPoolManager
{
    using CurrencyLibrary for address;

    address public poolImplementation;
    uint256 public totalCreated;
    mapping(uint256 => address) public _presales;
    mapping(address => address) public tokenToPresale;
    address public router;

    // Protocol fee variables
    uint256 public protocolFeeBps; // 2.5% default (250 basis points)
    uint256 public constant FEE_DENOMINATOR = 10000; // 100% = 10000 basis points
    uint256 public accumulatedFees;

    event PresaleCreated(
        address presaleAddress,
        address currency,
        uint256 amount,
        uint256 startTime,
        uint256 endTime
    );

    event ProtocolFeeUpdated(uint256 oldFee, uint256 newFee);
    event ProtocolFeesClaimed(uint256 amount, address recipient);
    event PoolImplementationUpdated(address oldImplementation, address newImplementation);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the contract with the pool implementation and router addresses
    /// @param _poolImplementation The address of the pool implementation contract
    /// @param _router The address of the router contract
    /// @param _owner The address of the contract owner
    function initialize(
        address _poolImplementation,
        address _router,
        address _owner
    ) public initializer {
        __ReentrancyGuard_init();
        __Ownable2Step_init();
        __UUPSUpgradeable_init();

        poolImplementation = _poolImplementation;
        router = _router;
        protocolFeeBps = 250; // 2.5% default (250 basis points)

        _transferOwnership(_owner);
    }

    /// @notice Authorizes the upgrade to a new implementation
    /// @param newImplementation The address of the new implementation
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @notice Creates a new presale contract with the given presale details.
    /// @param newPresale The presale details to be set for the new presale contract.
    /// @return The address of the newly created presale contract.
    function createPresale(
        Presale memory newPresale
    ) external nonReentrant returns (address) {
        require(
            newPresale.startTime >= block.timestamp,
            "Start time must be in the future"
        );

        // Create new ERC20 token
        DeployableERC20 newToken = new DeployableERC20(
            newPresale.tokenName,
            newPresale.tokenSymbol
        );
        address tokenAddress = address(newToken);
        newPresale.token = tokenAddress;

        bytes32 salt = keccak256(abi.encodePacked(msg.sender, tokenAddress));

        address presaleAddress = Clones.cloneDeterministic(
            poolImplementation,
            salt
        );
        _presales[totalCreated] = presaleAddress;
        IPool pool = IPool(presaleAddress);

        bool success = pool.initialize(msg.sender);
        require(success, "Error initializing presale");

        newToken.transferOwnership(presaleAddress);

        totalCreated++;
        uint256 totalAmount = pool.setPresale(newPresale);
        require(totalAmount > 0, "Amount must be greater than 0");

        tokenToPresale[tokenAddress] = presaleAddress;

        emit PresaleCreated(
            presaleAddress,
            tokenAddress,
            totalAmount,
            newPresale.startTime,
            newPresale.endTime
        );

        return presaleAddress;
    }

    /// @notice Updates the protocol fee percentage
    /// @param newFeeBps New fee in basis points (e.g., 250 = 2.5%)
    function setProtocolFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 1000, "Fee cannot exceed 10%"); // Max 10%
        uint256 oldFee = protocolFeeBps;
        protocolFeeBps = newFeeBps;
        emit ProtocolFeeUpdated(oldFee, newFeeBps);
    }

    /// @notice Updates the pool implementation address
    /// @param newImplementation New pool implementation address
    function setPoolImplementation(address newImplementation) external onlyOwner {
        require(newImplementation != address(0), "Implementation cannot be zero address");
        address oldImplementation = poolImplementation;
        poolImplementation = newImplementation;
        emit PoolImplementationUpdated(oldImplementation, newImplementation);
    }

    /// @notice Allows protocol owner to claim accumulated fees
    function claimProtocolFees() external onlyOwner {
        require(accumulatedFees > 0, "No fees to claim");
        uint256 amountToClaim = accumulatedFees;
        accumulatedFees = 0;

        CurrencyLibrary.safeTransferETH(msg.sender, amountToClaim);
        emit ProtocolFeesClaimed(amountToClaim, msg.sender);
    }

    /// @notice Internal function for pools to send fees
    function receiveProtocolFee() external payable {
        accumulatedFees += msg.value;
    }

    /// @notice Get current protocol fee in basis points
    /// @return Current fee in basis points
    function getProtocolFeeBps() external view returns (uint256) {
        return protocolFeeBps;
    }

    /// @notice Get accumulated protocol fees
    /// @return Amount of accumulated fees
    function getAccumulatedFees() external view returns (uint256) {
        return accumulatedFees;
    }

    /// @notice Get fee denominator (10000)
    /// @return Fee denominator
    function getFeeDenominator() external pure returns (uint256) {
        return FEE_DENOMINATOR;
    }

    /// @notice Returns the address of the presale contract at the specified index in the `_presales` array.
    /// @param index The index of the presale contract.
    /// @return poolAddress The address of the presale contract.
    function presales(
        uint256 index
    ) external view returns (address poolAddress) {
        poolAddress = _presales[index];
    }

    /// @notice Returns an array of all presale contract addresses created by the owner.
    /// @return poolAddresses An array of presale contract addresses.
    function getAllPresales()
        external
        view
        returns (address[] memory poolAddresses)
    {
        poolAddresses = new address[](totalCreated);
        for (uint256 i = 0; i < totalCreated; i++) {
            poolAddresses[i] = (_presales[i]);
        }
        return poolAddresses;
    }

    /// @param poolAddress The address of the presale contract.
    /// @return presaleDatas The presale data of the specified presale contract.
    function getPresalesData(
        IPool poolAddress
    ) external view returns (Presale memory presaleDatas) {
        return poolAddress.getPoolData();
    }

    /// @notice Returns the predicted address of a presale pool based on the pool owner and currency.
    /// @param poolOwner The address of the presale pool owner.
    /// @param token The address of the presale currency.
    /// @return poolAddress The predicted address of the presale pool.
    function getPoolAddress(
        address poolOwner,
        address token
    ) external view returns (address poolAddress) {
        bytes32 salt = keccak256(abi.encodePacked(poolOwner, token));
        poolAddress = Clones.predictDeterministicAddress(
            poolImplementation,
            salt
        );
    }

    function getPresaleTokenAddresses() external view returns (address[] memory) {
        address[] memory tokenAddresses = new address[](totalCreated);
        for (uint256 i = 0; i < totalCreated; i++) {
            Presale memory presale = IPool(_presales[i]).getPoolData();
            tokenAddresses[i] = presale.token;
        }
        return tokenAddresses;
    }

    function getPresaleAddress(address tokenAddress) external view returns (address) {
        return tokenToPresale[tokenAddress];
    }

    function getRouterAddress() external view returns (address) {
        return router;
    }

    function setRouterAddress(address newRouter) external onlyOwner {
        router = newRouter;
    }

    function isFinalizable(address poolAddress) external view returns (bool) {
        IPool pool = IPool(poolAddress);
        Presale memory presale = pool.getPoolData();
        Stats memory presaleStats = pool._presaleStats();

        if (presaleStats.isFinalized) {
            return false;
        }

        if (presaleStats.totalContributed >= presale.softcap && block.timestamp > presale.endTime) {
            return true;
        }

        if (presaleStats.totalContributed >= presale.hardcap) {
            return true;
        }

        return false;
    }
}
