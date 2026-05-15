// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title SafeTradeEscrow
 * @dev High-Trust Escrow Protocol for SafeTrade.
 */
contract SafeTradeEscrow is ReentrancyGuard, Ownable, Pausable {
    enum DealStatus { Created, Funded, Released, Disputed, Resolved, Refunded }

    struct Deal {
        address buyer;
        address vendor;
        uint256 amount;
        bytes32 itemHash;
        DealStatus status;
        bool buyerConfirmed;
        bool vendorConfirmed;
    }

    mapping(uint256 => Deal) public deals;
    uint256 public dealCount;
    uint256 public accumulatedFees;
    uint256 public constant FEE_BASIS_POINTS = 150; // 1.5% (150/10000)

    event DealCreated(uint256 indexed dealId, address indexed buyer, address indexed vendor, uint256 amount);
    event FundsReleased(uint256 indexed dealId, uint256 vendorAmount, uint256 feeAmount);
    event DisputeRaised(uint256 indexed dealId, address raisedBy);
    event DisputeResolved(uint256 indexed dealId, address winner, uint256 amountSent, uint256 feeAmount);

    constructor() {}

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function createDeal(address _vendor, bytes32 _itemHash) external payable whenNotPaused {
        require(msg.value > 0, "Amount must be greater than zero");
        
        dealCount++;
        deals[dealCount] = Deal({
            buyer: msg.sender,
            vendor: _vendor,
            amount: msg.value,
            itemHash: _itemHash,
            status: DealStatus.Funded,
            buyerConfirmed: false,
            vendorConfirmed: false
        });

        emit DealCreated(dealCount, msg.sender, _vendor, msg.value);
    }

    function releaseFunds(uint256 _dealId) external nonReentrant whenNotPaused {
        Deal storage deal = deals[_dealId];
        require(msg.sender == deal.buyer, "Only buyer can release funds");
        require(deal.status == DealStatus.Funded, "Invalid deal status");

        uint256 fee = (deal.amount * FEE_BASIS_POINTS) / 10000;
        uint256 vendorAmount = deal.amount - fee;

        deal.status = DealStatus.Released;
        accumulatedFees += fee;
        
        // Transfer to vendor
        (bool successVendor, ) = payable(deal.vendor).call{value: vendorAmount}("");
        require(successVendor, "Transfer to vendor failed");

        emit FundsReleased(_dealId, vendorAmount, fee);
    }

    function raiseDispute(uint256 _dealId) external whenNotPaused {
        Deal storage deal = deals[_dealId];
        require(msg.sender == deal.buyer || msg.sender == deal.vendor, "Not a party to this deal");
        require(deal.status == DealStatus.Funded, "Cannot dispute this deal");

        deal.status = DealStatus.Disputed;
        emit DisputeRaised(_dealId, msg.sender);
    }

    function resolveDispute(uint256 _dealId, address _winner) external onlyOwner nonReentrant {
        Deal storage deal = deals[_dealId];
        require(deal.status == DealStatus.Disputed, "Not in dispute");
        require(_winner == deal.buyer || _winner == deal.vendor, "Invalid winner");

        deal.status = DealStatus.Resolved;
        
        if (_winner == deal.buyer) {
            // Full refund to buyer, no fee
            (bool success, ) = payable(deal.buyer).call{value: deal.amount}("");
            require(success, "Refund failed");
            emit DisputeResolved(_dealId, deal.buyer, deal.amount, 0);
        } else {
            // Resolution for vendor, collect fee
            uint256 fee = (deal.amount * FEE_BASIS_POINTS) / 10000;
            uint256 vendorAmount = deal.amount - fee;
            accumulatedFees += fee;

            (bool success, ) = payable(deal.vendor).call{value: vendorAmount}("");
            require(success, "Transfer failed");
            emit DisputeResolved(_dealId, deal.vendor, vendorAmount, fee);
        }
    }

    function withdrawFees() external onlyOwner nonReentrant {
        require(accumulatedFees > 0, "No fees to withdraw");
        uint256 amount = accumulatedFees;
        accumulatedFees = 0;
        
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Withdrawal failed");
    }

    function getDeal(uint256 _dealId) external view returns (Deal memory) {
        return deals[_dealId];
    }
}
