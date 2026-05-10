// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SafeTradeEscrow
 * @dev High-Trust Escrow Protocol for SafeTrade.
 */
contract SafeTradeEscrow {
    enum DealStatus { Created, Funded, Released, Disputed, Resolved, Refunded }

    struct Deal {
        address buyer;
        address vendor;
        uint256 amount;
        bytes32 itemHash; // IPFS hash or metadata hash
        DealStatus status;
        bool buyerConfirmed;
        bool vendorConfirmed;
    }

    mapping(uint256 => Deal) public deals;
    uint256 public dealCount;
    address public admin;

    event DealCreated(uint256 indexed dealId, address indexed buyer, address indexed vendor, uint256 amount);
    event FundsReleased(uint256 indexed dealId);
    event DisputeRaised(uint256 indexed dealId, address raisedBy);
    event DisputeResolved(uint256 indexed dealId, address winner);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function createDeal(address _vendor, bytes32 _itemHash) external payable {
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

    function releaseFunds(uint256 _dealId) external {
        Deal storage deal = deals[_dealId];
        require(msg.sender == deal.buyer, "Only buyer can release funds");
        require(deal.status == DealStatus.Funded, "Invalid deal status");

        deal.status = DealStatus.Released;
        payable(deal.vendor).transfer(deal.amount);

        emit FundsReleased(_dealId);
    }

    function raiseDispute(uint256 _dealId) external {
        Deal storage deal = deals[_dealId];
        require(msg.sender == deal.buyer || msg.sender == deal.vendor, "Not a party to this deal");
        require(deal.status == DealStatus.Funded, "Cannot dispute this deal");

        deal.status = DealStatus.Disputed;
        emit DisputeRaised(_dealId, msg.sender);
    }

    function resolveDispute(uint256 _dealId, address _winner) external onlyAdmin {
        Deal storage deal = deals[_dealId];
        require(deal.status == DealStatus.Disputed, "Not in dispute");
        require(_winner == deal.buyer || _winner == deal.vendor, "Invalid winner");

        deal.status = DealStatus.Resolved;
        payable(_winner).transfer(deal.amount);

        emit DisputeResolved(_dealId, _winner);
    }

    function getDeal(uint256 _dealId) external view returns (Deal memory) {
        return deals[_dealId];
    }
}
