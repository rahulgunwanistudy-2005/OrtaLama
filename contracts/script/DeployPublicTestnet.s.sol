// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.30;

import {CommitmentValidityVerifier} from "../src/CommitmentValidityVerifier.sol";
import {BelowThresholdVerifier} from "../src/BelowThresholdVerifier.sol";
import {OrtalamaRound} from "../src/OrtalamaRound.sol";
import {BadgeRegistry} from "../src/BadgeRegistry.sol";

interface DeploymentVm {
    function startBroadcast(address sender) external;
    function stopBroadcast() external;
}

/// Dry-run all constructor dependencies on a fork. This script needs no key.
contract DeployPublicTestnet {
    DeploymentVm constant vm = DeploymentVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    function run(address governor) external {
        require(block.chainid == 10143, "Monad testnet only");
        vm.startBroadcast(governor);
        CommitmentValidityVerifier validity = new CommitmentValidityVerifier();
        BelowThresholdVerifier below = new BelowThresholdVerifier();
        OrtalamaRound rounds = new OrtalamaRound(governor, address(validity));
        new BadgeRegistry(address(rounds), address(below));
        vm.stopBroadcast();
    }
}
