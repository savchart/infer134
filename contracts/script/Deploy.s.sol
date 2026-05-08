// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {InferenceEscrow} from "../src/InferenceEscrow.sol";

contract Deploy {
    function run() external returns (InferenceEscrow) {
        return new InferenceEscrow();
    }
}

