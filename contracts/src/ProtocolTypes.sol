// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {BabyJubjub} from "./BabyJubjub.sol";

library ProtocolTypes {
    struct Proof {
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
        uint256 contextTag;
    }

    struct Statement {
        uint256 roundId;
        bytes32 installationId;
        BabyJubjub.Point CE;
        BabyJubjub.Point CP;
        BabyJubjub.Point AE;
        BabyJubjub.Point AP;
        bytes32 reportHash;
        bytes32 metadataHash;
        bytes32 pqKeyHash;
    }

    struct Sum {
        uint256 E;
        uint256 r;
        uint256 P;
        uint256 s;
    }
}

interface ICommitmentValidityVerifier {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[14] calldata inputs
    ) external view returns (bool);
}

interface IBelowThresholdVerifier {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[13] calldata inputs
    ) external view returns (bool);
}
