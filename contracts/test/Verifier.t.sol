// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {Test} from "forge-std/Test.sol";
import {BelowThresholdVerifier} from "../src/BelowThresholdVerifier.sol";
import {CommitmentValidityVerifier} from "../src/CommitmentValidityVerifier.sol";
import {ProtocolTypes as T} from "../src/ProtocolTypes.sol";

contract VerifierTest is Test {
    uint256 private constant Q = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    BelowThresholdVerifier private badge;
    CommitmentValidityVerifier private validity;
    T.Proof private badgeProof;
    T.Proof private validityProof;
    uint256[13] private badgeInputs;
    uint256[14] private validityInputs;

    function setUp() public {
        badge = new BelowThresholdVerifier();
        validity = new CommitmentValidityVerifier();
        string[] memory args = new string[](4);
        args[0] = "node";
        args[1] = "--import";
        args[2] = "tsx";
        args[3] = "scripts/verifier-fixtures.mjs";
        string memory file = abi.decode(vm.ffi(args), (string));
        string memory data = vm.readFile(file);
        assertTrue(vm.parseJsonBool(data, ".simulation"));
        badgeProof = abi.decode(vm.parseJsonBytes(data, ".below_threshold.proof"), (T.Proof));
        validityProof = abi.decode(vm.parseJsonBytes(data, ".commitment_validity.proof"), (T.Proof));
        badgeInputs = abi.decode(vm.parseJsonBytes(data, ".below_threshold.inputs"), (uint256[13]));
        validityInputs = abi.decode(vm.parseJsonBytes(data, ".commitment_validity.inputs"), (uint256[14]));
    }

    function testRealProofs() public view {
        assertTrue(badge.verifyProof(badgeProof.a, badgeProof.b, badgeProof.c, badgeInputs));
        assertTrue(validity.verifyProof(validityProof.a, validityProof.b, validityProof.c, validityInputs));
    }

    function testEveryPublicInputMutationAndFieldBound() public view {
        for (uint256 i; i < 13; ++i) {
            uint256[13] memory changed = badgeInputs;
            changed[i] = (changed[i] + 1) % Q;
            assertFalse(badge.verifyProof(badgeProof.a, badgeProof.b, badgeProof.c, changed));
            changed[i] = Q;
            assertFalse(badge.verifyProof(badgeProof.a, badgeProof.b, badgeProof.c, changed));
        }
        for (uint256 i; i < 14; ++i) {
            uint256[14] memory changed = validityInputs;
            changed[i] = (changed[i] + 1) % Q;
            assertFalse(validity.verifyProof(validityProof.a, validityProof.b, validityProof.c, changed));
            changed[i] = Q;
            assertFalse(validity.verifyProof(validityProof.a, validityProof.b, validityProof.c, changed));
        }
    }

    function testMalformedProofPointsFail() public view {
        T.Proof memory p = badgeProof;
        p.a[0] = 1;
        p.a[1] = 1;
        assertFalse(badge.verifyProof{gas: 1_000_000}(p.a, p.b, p.c, badgeInputs));
        p = validityProof;
        p.c[0] = 1;
        p.c[1] = 1;
        assertFalse(validity.verifyProof{gas: 1_000_000}(p.a, p.b, p.c, validityInputs));
    }

    function testUnderfundedPrecompileFailsClosed() public view {
        (bool ok, bytes memory returned) = address(badge).staticcall{gas: 8000}(
            abi.encodeCall(badge.verifyProof, (badgeProof.a, badgeProof.b, badgeProof.c, badgeInputs))
        );
        assertTrue(!ok || (returned.length == 32 && !abi.decode(returned, (bool))));
        (ok, returned) = address(validity).staticcall{gas: 8000}(
            abi.encodeCall(validity.verifyProof, (validityProof.a, validityProof.b, validityProof.c, validityInputs))
        );
        assertTrue(!ok || (returned.length == 32 && !abi.decode(returned, (bool))));
    }
}
