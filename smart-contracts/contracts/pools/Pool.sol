// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;
import {CurrencyLibrary} from "../libraries/CurrencyLibrary.sol";
import {Presale, Contributor} from "../interfaces/IPresale.sol";
import {IRouterV2} from "../interfaces/IRouterV2.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {DeployableERC20} from "../token/DeployableERC20.sol";
import {IPoolManager} from "../interfaces/IPoolManager.sol";

contract Pool is ReentrancyGuard {
    using CurrencyLibrary for address;

    struct Stats {
        uint256 totalContributed;
        uint256 totalTokenAmount;
        uint256 totalClaimed;
        bool isFinalized;
    }

    bool public isInit;

    address public owner;
    address public factory;
    address public token;

    Presale public presale;
    Stats public _presaleStats;

    mapping(address => Contributor) public _contributors;

// Events
    event Contribute(address contributor, uint256 amount, uint256 timestamp);
    event Claimed(address contributor, uint256 amount, uint256 timestamp);
    event EmergencyWithdrawal(
        address contributor,
        uint256 amount,
        uint256 timestamp
    );
    event Finalized(uint256 timestamp);
    event Cancelled(uint256 timestam);
    event AddedWhitelist(uint256 addresses, uint256 timestamp);
    event Withdrawn(address user, uint256 amount, uint256 timestamp);
    event ProtocolFeeSent(uint256 amount, uint256 timestamp);

    error ClaimError(address user);
// Errors

    modifier isInitialized() {
        require(!isInit, "Already initialized");
        _;
        isInit = true;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "You are not owner");
        _;
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "You are not factory");
        _;
    }

    receive() external payable {
        contribute();
    }

    fallback() external payable {
        contribute();
    }

    /// @notice This function initializes the contract.
    /// @param _owner The address of the owner of the contract.
    /// @return A boolean value indicating whether the initialization was successful.
    ///
    /// Sets the contract `_factory` to the caller of the function and the contract `owner` to the provided owner address.
    function initialize(address _owner) external isInitialized returns (bool) {
        factory = msg.sender;
        owner = _owner;

        return true;
    }

    /// @notice This function sets the presale details for the proxy contract.
    /// @param saleInfo A `Presale` struct containing the presale details.
    /// @dev The function can only be called by the factory.
    function setPresale(
        Presale memory saleInfo
    ) external onlyFactory returns (uint256) {
        token = saleInfo.token;
        presale = saleInfo;

        uint256 totalTokenAmount = saleInfo.hardcap * saleInfo.presaleRate;
        totalTokenAmount += saleInfo.hardcap * saleInfo.listingRate;

        _presaleStats.totalTokenAmount = totalTokenAmount;

        return totalTokenAmount;
    }

    /// @notice Finalizes the presale based on the defined conditions
    /// @return A boolean value indicating whether the operation succeeded
    function finalize() external returns (bool) {
        Stats storage presaleStats = _presaleStats;

        require(!presaleStats.isFinalized, "Presale is finalized.");

        Presale memory _presale = presale;

        uint256 totalContributedEth = _presaleStats.totalContributed;
        require(
            (_presale.softcap < totalContributedEth &&
                block.timestamp > _presale.endTime) ||
                totalContributedEth >= _presale.hardcap,
            "Presale is not over yet"
        );

        presaleStats.isFinalized = true;

        uint256 liquidityAmount = totalContributedEth * _presale.listingRate;
        DeployableERC20(token).mint(address(this), liquidityAmount);
        DeployableERC20(token).unpause();

        _addLiquidityETH(
            _presale.token,
            liquidityAmount,
            totalContributedEth
        );

        emit Finalized(block.timestamp);

        return true;
    }

    /// @notice Changes the factory address used for the presale.
    /// @dev This function can only be executed by the current factory address.
    /// @param _factory The new factory address to be set.
    function changeFactoryAddress(address _factory) external onlyFactory {
        require(
            _factory != address(0),
            "Factory address does not equal zero address"
        );
        factory = _factory;
    }

    /// @notice Performs an emergency withdrawal for the caller.
    /// @dev Allows a contributor to perform an emergency withdrawal of their contributed funds.
    ///      It can only be called before the presale is finalized.
    ///      The contributor's total contribution is deducted from the presale's total contributed amount.
    ///      The 80% of the total contribution is transferred to the caller.
    ///      The 20% of the total contribution is kept as fee for early withdrawal.
    ///      The contributor's total contribution and claimed amount are set to 0.
    function expressWithdrawal() external {
        Stats storage presaleStats = _presaleStats;
        require(!presaleStats.isFinalized, "Presale is already finalized");

        Contributor storage contributor = _contributors[msg.sender];
        require(contributor.totalContributed > 0, "You are not contributor");

        uint256 repayAmount = (contributor.totalContributed * 80) / 100;

        presaleStats.totalContributed -= repayAmount;
        contributor.totalContributed = 0;

        // FIX: Burn actual current balance instead of claimed amount
        uint256 currentBalance = DeployableERC20(token).balanceOf(msg.sender);
        DeployableERC20(token).burn(msg.sender, currentBalance);
        contributor.claimed = 0;

        CurrencyLibrary.safeTransferETH(msg.sender, repayAmount);

        emit EmergencyWithdrawal(msg.sender, repayAmount, block.timestamp);
    }

    /// @notice Contributes funds to the presale.
    /// @dev Allows a user to contribute funds to the presale by sending Ether to the contract.
    /// @return A boolean value indicating the success of the contribution.
    function contribute() public payable nonReentrant returns (bool) {
        Presale memory _presale = presale;
        Stats storage presaleStats = _presaleStats;
        require(
            !presaleStats.isFinalized &&
            block.timestamp >= _presale.startTime &&
            block.timestamp <= _presale.endTime,
            "The presale is not active at this time."
        );

        // Get protocol fee from PoolManager
        uint256 protocolFeeBps = IPoolManager(factory).getProtocolFeeBps();
        uint256 feeDenominator = IPoolManager(factory).getFeeDenominator();

        // Calculate protocol fee and net contribution
        uint256 protocolFee = (msg.value * protocolFeeBps) / feeDenominator;
        uint256 netContribution = msg.value - protocolFee;

        require(presaleStats.totalContributed + netContribution <= _presale.hardcap, "Hardcap exceeded");

        // Send protocol fee to PoolManager
        if (protocolFee > 0) {
            IPoolManager(factory).receiveProtocolFee{value: protocolFee}();
            emit ProtocolFeeSent(protocolFee, block.timestamp);
        }

        Contributor storage contributor = _contributors[msg.sender];

        presaleStats.totalContributed += netContribution;
        contributor.totalContributed += netContribution;
        contributor.claimed += netContribution * _presale.presaleRate;

        DeployableERC20(token).mint(msg.sender, netContribution * _presale.presaleRate);

        emit Contribute(msg.sender, netContribution, block.timestamp);

        return true;
    }

    /// @notice Adds liquidity to an ETH-based trading pair.
    /// @param tokenP The address of the token to be added as liquidity.
    /// @param amountTokenDesired The desired amount of the token to add as liquidity.
    /// @param amountETH The amount of ETH to be added as liquidity.
    function _addLiquidityETH(
        address tokenP,
        uint amountTokenDesired,
        uint amountETH
    ) private {
        address router = IPoolManager(factory).getRouterAddress();
        tokenP.safeApprove(router, amountTokenDesired);
        IRouterV2(router).addLiquiditySEI{value: amountETH}(
            tokenP,
            amountTokenDesired,
            0,
            0,
            address(0), // LP tokens get burned to pride permanent liquidity to the pool
            block.timestamp
        );
    }

    /// @notice Returns the presale data.
    function getPoolData()
        public
        view
        returns (Presale memory)
    {
        return presale;
    }
}
