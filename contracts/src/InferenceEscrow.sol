// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title InferenceEscrow
/// @notice Local MVP escrow for offchain inference work.
/// @dev Prompts and outputs stay offchain. The contract stores only hashes and payment state.
contract InferenceEscrow {
    enum JobStatus {
        Created,
        ResultSubmitted,
        Paid,
        Cancelled
    }

    struct Job {
        address payable buyer;
        address payable worker;
        uint256 escrowAmount;
        uint256 requestedPayment;
        bytes32 inputHash;
        bytes32 outputHash;
        bytes32 receiptHash;
        JobStatus status;
    }

    uint256 public nextJobId = 1;
    mapping(uint256 => Job) public jobs;

    event JobCreated(
        uint256 indexed jobId,
        address indexed buyer,
        address indexed worker,
        bytes32 inputHash,
        uint256 escrowAmount
    );

    event ResultSubmitted(
        uint256 indexed jobId,
        address indexed worker,
        bytes32 outputHash,
        bytes32 receiptHash,
        uint256 requestedPayment
    );

    event PaymentReleased(
        uint256 indexed jobId,
        address indexed buyer,
        address indexed worker,
        uint256 paidAmount,
        uint256 refundedAmount
    );

    event JobCancelled(uint256 indexed jobId, address indexed buyer, uint256 refund);

    error InvalidWorker();
    error EmptyEscrow();
    error JobNotFound();
    error NotBuyer();
    error NotWorker();
    error InvalidStatus();
    error PaymentExceedsEscrow();
    error TransferFailed();

    function createJob(address payable worker, bytes32 inputHash) external payable returns (uint256 jobId) {
        if (worker == address(0)) revert InvalidWorker();
        if (msg.value == 0) revert EmptyEscrow();

        jobId = nextJobId++;
        jobs[jobId] = Job({
            buyer: payable(msg.sender),
            worker: worker,
            escrowAmount: msg.value,
            requestedPayment: 0,
            inputHash: inputHash,
            outputHash: bytes32(0),
            receiptHash: bytes32(0),
            status: JobStatus.Created
        });

        emit JobCreated(jobId, msg.sender, worker, inputHash, msg.value);
    }

    function submitResult(
        uint256 jobId,
        bytes32 outputHash,
        bytes32 receiptHash,
        uint256 requestedPayment
    ) external {
        Job storage job = _existingJob(jobId);
        if (msg.sender != job.worker) revert NotWorker();
        if (job.status != JobStatus.Created) revert InvalidStatus();
        if (requestedPayment > job.escrowAmount) revert PaymentExceedsEscrow();

        job.outputHash = outputHash;
        job.receiptHash = receiptHash;
        job.requestedPayment = requestedPayment;
        job.status = JobStatus.ResultSubmitted;

        emit ResultSubmitted(jobId, msg.sender, outputHash, receiptHash, requestedPayment);
    }

    function releasePayment(uint256 jobId) external {
        Job storage job = _existingJob(jobId);
        if (msg.sender != job.buyer) revert NotBuyer();
        if (job.status != JobStatus.ResultSubmitted) revert InvalidStatus();

        uint256 payment = job.requestedPayment;
        uint256 refund = job.escrowAmount - payment;
        address payable buyer = job.buyer;
        address payable worker = job.worker;

        job.status = JobStatus.Paid;
        job.escrowAmount = 0;

        if (payment > 0) {
            (bool paidWorker, ) = worker.call{value: payment}("");
            if (!paidWorker) revert TransferFailed();
        }

        if (refund > 0) {
            (bool refundedBuyer, ) = buyer.call{value: refund}("");
            if (!refundedBuyer) revert TransferFailed();
        }

        emit PaymentReleased(jobId, buyer, worker, payment, refund);
    }

    function cancelJob(uint256 jobId) external {
        Job storage job = _existingJob(jobId);
        if (msg.sender != job.buyer) revert NotBuyer();
        if (job.status != JobStatus.Created) revert InvalidStatus();

        uint256 refund = job.escrowAmount;
        address payable buyer = job.buyer;
        job.status = JobStatus.Cancelled;
        job.escrowAmount = 0;

        (bool refundedBuyer, ) = buyer.call{value: refund}("");
        if (!refundedBuyer) revert TransferFailed();

        emit JobCancelled(jobId, buyer, refund);
    }

    function _existingJob(uint256 jobId) internal view returns (Job storage job) {
        job = jobs[jobId];
        if (job.buyer == address(0)) revert JobNotFound();
    }
}
