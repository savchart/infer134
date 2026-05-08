// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {InferenceEscrow} from "../src/InferenceEscrow.sol";

contract WorkerActor {
    function submit(
        InferenceEscrow escrow,
        uint256 jobId,
        bytes32 outputHash,
        bytes32 receiptHash,
        uint256 requestedPayment
    ) external {
        escrow.submitResult(jobId, outputHash, receiptHash, requestedPayment);
    }

    receive() external payable {}
}

contract InferenceEscrowTest {
    receive() external payable {}

    function testHappyPathReleasesPayment() public {
        InferenceEscrow escrow = new InferenceEscrow();
        WorkerActor worker = new WorkerActor();

        bytes32 inputHash = keccak256("offchain input");
        bytes32 outputHash = keccak256("offchain output");
        bytes32 receiptHash = keccak256("execution receipt");

        uint256 escrowAmount = 1 ether;
        uint256 requestedPayment = 0.4 ether;
        uint256 workerBefore = address(worker).balance;

        uint256 jobId = escrow.createJob{value: escrowAmount}(payable(address(worker)), inputHash);
        worker.submit(escrow, jobId, outputHash, receiptHash, requestedPayment);
        escrow.releasePayment(jobId);

        (
            ,
            ,
            uint256 remainingEscrow,
            uint256 storedPayment,
            ,
            bytes32 storedOutputHash,
            bytes32 storedReceiptHash,
            InferenceEscrow.JobStatus status
        ) = escrow.jobs(jobId);

        require(address(worker).balance == workerBefore + requestedPayment, "worker was not paid");
        require(remainingEscrow == 0, "escrow was not cleared");
        require(storedPayment == requestedPayment, "payment mismatch");
        require(storedOutputHash == outputHash, "output hash mismatch");
        require(storedReceiptHash == receiptHash, "receipt hash mismatch");
        require(status == InferenceEscrow.JobStatus.Paid, "job not paid");
    }

    function testBuyerCanCancelBeforeResultSubmission() public {
        InferenceEscrow escrow = new InferenceEscrow();
        WorkerActor worker = new WorkerActor();

        uint256 jobId = escrow.createJob{value: 1 ether}(payable(address(worker)), keccak256("input"));
        uint256 balanceBefore = address(this).balance;

        escrow.cancelJob(jobId);

        (, , uint256 remainingEscrow, , , , , InferenceEscrow.JobStatus status) = escrow.jobs(jobId);

        require(remainingEscrow == 0, "escrow was not cleared");
        require(status == InferenceEscrow.JobStatus.Cancelled, "job not cancelled");
        require(address(this).balance == balanceBefore + 1 ether, "buyer was not refunded");
    }
}
