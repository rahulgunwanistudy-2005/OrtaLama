// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {OrtalamaRound} from "./OrtalamaRound.sol";
import {ProtocolTypes as T, IBelowThresholdVerifier} from "./ProtocolTypes.sol";
import {BelowThresholdVerifier} from "./BelowThresholdVerifier.sol";

/// @notice Non-transferable evidence records keyed to installations, not tokens.
contract BadgeRegistry {
    struct Badge {
        bool issued;
        uint64 roundId;
        bytes32 installationId;
        uint64 thresholdId;
        bytes32 proofHash;
    }
    OrtalamaRound public immutable rounds;
    IBelowThresholdVerifier public immutable verifier;
    mapping(bytes32 => Badge) private records;
    error InvalidParams();
    error WrongRound();
    error UnknownPlant();
    error AlreadyBadged();
    error InvalidProof();
    event BadgeAttested(
        bytes32 indexed badgeId,
        uint64 indexed roundId,
        bytes32 indexed installationId,
        uint64 thresholdId,
        bytes32 proofHash
    );

    constructor(address rounds_, address verifier_) {
        if (rounds_.code.length == 0 || verifier_.codehash != keccak256(type(BelowThresholdVerifier).runtimeCode)) {
            revert InvalidParams();
        }
        rounds = OrtalamaRound(rounds_);
        verifier = IBelowThresholdVerifier(verifier_);
    }

    function badgeId(uint64 roundId, bytes32 installationId, uint64 thresholdId) public pure returns (bytes32) {
        return keccak256(abi.encode(roundId, installationId, thresholdId));
    }

    function attest(
        uint64 roundId,
        uint64 proofRoundId,
        bytes32 installationId,
        uint64 thresholdId,
        T.Proof calldata proof
    ) external returns (bytes32 id) {
        if (roundId != proofRoundId) revert WrongRound();
        (uint256 numerator, uint256 denominator) = rounds.threshold(roundId, thresholdId);
        OrtalamaRound.Plant memory plant = rounds.getPlant(roundId, installationId);
        if (!plant.committed) revert UnknownPlant();
        id = badgeId(roundId, installationId, thresholdId);
        if (records[id].issued) revert AlreadyBadged();
        uint256[13] memory inputs = [
            plant.statement.CE.x,
            plant.statement.CE.y,
            plant.statement.CP.x,
            plant.statement.CP.y,
            numerator,
            denominator,
            uint256(roundId),
            uint256(installationId) >> 128,
            uint256(uint128(uint256(installationId))),
            uint256(thresholdId),
            block.chainid,
            uint256(uint160(address(this))),
            proof.contextTag
        ];
        if (!verifier.verifyProof{gas: 1_000_000}(proof.a, proof.b, proof.c, inputs)) revert InvalidProof();
        bytes32 proofHash = keccak256(abi.encode(proof, inputs));
        records[id] = Badge(true, roundId, installationId, thresholdId, proofHash);
        emit BadgeAttested(id, roundId, installationId, thresholdId, proofHash);
    }

    function getBadge(bytes32 id) external view returns (Badge memory) {
        return records[id];
    }
}
