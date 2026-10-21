// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {Test} from "forge-std/Test.sol";
import {VmSafe} from "forge-std/Vm.sol";
import {OrtalamaRound as R} from "../src/OrtalamaRound.sol";
import {BadgeRegistry} from "../src/BadgeRegistry.sol";
import {CommitmentValidityVerifier} from "../src/CommitmentValidityVerifier.sol";
import {BelowThresholdVerifier} from "../src/BelowThresholdVerifier.sol";
import {ProtocolTypes as T} from "../src/ProtocolTypes.sol";
import {BabyJubjub as B} from "../src/BabyJubjub.sol";

abstract contract RoundFixture is Test {
    uint256 internal constant L = 2736030358979909402780800718157159386076813972158567259200215660948447373041;
    uint256 internal constant Q = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    R internal round;
    BadgeRegistry internal registry;
    CommitmentValidityVerifier internal validityVerifier;
    BelowThresholdVerifier internal belowVerifier;
    string internal json;
    uint64 internal id;

    struct Submission {
        T.Statement statement;
        bytes32 validationHash;
        bytes32[3] ciphertextHashes;
        bytes verifierSignature;
        bytes pqLink;
        bytes32 pqSignatureHash;
        bytes32[] cohortProof;
        T.Proof proof;
    }

    function setUp() public virtual {
        vm.chainId(31337);
        vm.warp(1000);
        validityVerifier = new CommitmentValidityVerifier();
        belowVerifier = new BelowThresholdVerifier();
        round = new R(address(this), address(validityVerifier));
        registry = new BadgeRegistry(address(round), address(belowVerifier));
        json = _fixtures(1);
        id = round.createRound(_config(json));
        round.open(id);
    }

    function _fixtures(uint64 roundId) internal returns (string memory) {
        string[] memory command = new string[](7);
        command[0] = "node";
        command[1] = "--import";
        command[2] = "tsx";
        command[3] = "scripts/contract-fixtures.ts";
        command[4] = vm.toString(address(round));
        command[5] = vm.toString(address(registry));
        command[6] = vm.toString(roundId);
        string memory file = abi.decode(vm.ffi(command), (string));
        string memory data = vm.readFile(file);
        assertTrue(vm.parseJsonBool(data, ".simulation"));
        return data;
    }

    function _config(string memory data) internal view returns (R.Config memory cfg) {
        cfg.productCN = bytes8("25231000");
        cfg.country = bytes2("TR");
        cfg.period = 2025;
        cfg.cohortRoot = vm.parseJsonBytes32(data, ".cohortRoot");
        cfg.verifierRoot = vm.parseJsonBytes32(data, ".verifierRoot");
        for (uint256 i; i < 3; ++i) {
            cfg.trustees[i] = vm.parseJsonAddress(data, string.concat(".trustees[", vm.toString(i), "]"));
            cfg.encryptionKeys[i] = vm.parseJsonBytes32(data, string.concat(".encryptionKeys[", vm.toString(i), "]"));
        }
        cfg.commitDeadline = uint64(block.timestamp + 100);
        cfg.sharingDeadline = uint64(block.timestamp + 200);
        cfg.closingDeadline = uint64(block.timestamp + 300);
        cfg.minimumPlants = 5;
        cfg.sectorProduction = 15000;
        cfg.sectorAttestationHash = keccak256("SIMULATED sector attestation");
        cfg.metadataHash = keccak256("SIMULATED contract fixture");
        cfg.fixedThresholdCount = 1;
        cfg.thresholdNumerators[0] = 1000;
        cfg.thresholdDenominators[0] = 1000;
        cfg.simulated = true;
    }

    function _path(uint256 i, string memory field) internal pure returns (string memory) {
        return string.concat(".plants[", vm.toString(i), "].", field);
    }

    function _load(uint256 i) internal view returns (Submission memory x) {
        x.statement = abi.decode(vm.parseJsonBytes(json, _path(i, "statement")), (T.Statement));
        x.validationHash = vm.parseJsonBytes32(json, _path(i, "validationHash"));
        x.ciphertextHashes = abi.decode(vm.parseJsonBytes(json, _path(i, "ciphertextHashes")), (bytes32[3]));
        x.verifierSignature = vm.parseJsonBytes(json, _path(i, "verifierSignature"));
        x.pqLink = vm.parseJsonBytes(json, _path(i, "pqLink"));
        x.pqSignatureHash = vm.parseJsonBytes32(json, _path(i, "pqSignatureHash"));
        x.cohortProof = abi.decode(vm.parseJsonBytes(json, _path(i, "cohortProof")), (bytes32[]));
        x.proof = abi.decode(vm.parseJsonBytes(json, _path(i, "proof")), (T.Proof));
    }

    function _submit(Submission memory x) internal {
        round.commit(
            x.statement,
            x.validationHash,
            x.ciphertextHashes,
            x.verifierSignature,
            x.pqLink,
            x.pqSignatureHash,
            x.cohortProof,
            new bytes32[](0),
            x.proof
        );
    }

    function _commit(uint256 count) internal {
        for (uint256 i; i < count; ++i) {
            _submit(_load(i));
        }
    }

    function _signature(uint256 key, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _resign(Submission memory x) internal view returns (Submission memory) {
        bytes32 digest = round.statementDigest(x.statement);
        x.verifierSignature = _signature(1, digest);
        x.pqLink = _signature(1, round.pqLinkDigest(digest, x.pqSignatureHash));
        return x;
    }

    function _ack(uint256 count, uint8 index) internal {
        for (uint256 i; i < count; ++i) {
            Submission memory x = _load(i);
            vm.prank(vm.addr(uint256(index) + 1));
            round.acknowledge(id, x.statement.installationId, index, x.ciphertextHashes[index - 1]);
        }
    }

    function _sum(uint256 count, uint8 index) internal view returns (T.Sum memory result) {
        for (uint256 i; i < count; ++i) {
            T.Sum memory s = abi.decode(
                vm.parseJsonBytes(json, string.concat(_path(i, "shares"), "[", vm.toString(index - 1), "]")), (T.Sum)
            );
            result.E = addmod(result.E, s.E, L);
            result.r = addmod(result.r, s.r, L);
            result.P = addmod(result.P, s.P, L);
            result.s = addmod(result.s, s.s, L);
        }
    }

    function _prepare(uint256 count, uint8 a, uint8 b) internal {
        _commit(count);
        round.startSharing(id);
        _ack(count, a);
        _ack(count, b);
        round.startClosing(id);
    }

    function _publish(uint256 count, uint8 index) internal {
        bytes32 manifest = round.getRound(id).manifestHash;
        T.Sum memory sums = _sum(count, index);
        vm.prank(vm.addr(uint256(index) + 1));
        round.publishSum(id, index, manifest, sums);
    }

    function _roundTrip(uint256 count, uint8 a, uint8 b) internal {
        _prepare(count, a, b);
        _publish(count, a);
        _publish(count, b);
        round.close(id);
        R.Round memory result = round.getRound(id);
        uint256 expectedE;
        uint256 expectedP;
        for (uint256 i; i < count; ++i) {
            expectedE += vm.parseJsonUint(json, _path(i, "E"));
            expectedP += vm.parseJsonUint(json, _path(i, "P"));
        }
        assertEq(result.SE, expectedE);
        assertEq(result.SP, expectedP);
        assertEq(result.intensity, expectedE * 1_000_000 / expectedP);
        assertEq(result.coveragePpm, expectedP * 1_000_000 / result.config.sectorProduction);
        assertEq(result.representative, 5 * expectedP >= 4 * uint256(result.config.sectorProduction));
        assertEq(uint256(result.state), uint256(R.State.Closed));
    }

    function _badge(string memory name) internal view returns (T.Proof memory) {
        return abi.decode(vm.parseJsonBytes(json, string.concat(".badges.", name)), (T.Proof));
    }
}

contract RoundTest is RoundFixture {
    function testGasCloseTwelvePlants() public {
        _prepare(12, 1, 2);
        _publish(12, 1);
        _publish(12, 2);
        vm.startSnapshotGas("OrtalamaRound", "close-twelve-plants");
        round.close(id);
        uint256 used = vm.stopSnapshotGas();
        if (!vm.isContext(VmSafe.ForgeContext.Coverage)) assertLt(used, 8_000_000);
        assertEq(round.getRound(id).SE, 10560);
    }

    function testTwelvePlantRoundAndNonTransferableBadges() public {
        _roundTrip(12, 1, 2);
        bytes32 installation = _load(0).statement.installationId;
        bytes32 badge = registry.attest(id, id, installation, 0, _badge("below"));
        assertTrue(registry.getBadge(badge).issued);
        assertEq(registry.getBadge(badge).installationId, installation);
        registry.attest(id, id, _load(6).statement.installationId, 0, _badge("equal"));
        registry.attest(id, id, installation, 1, _badge("fixed"));
        (bool transferred,) = address(registry)
            .call(
                abi.encodeWithSignature(
                    "transferFrom(address,address,uint256)", address(this), address(77), uint256(badge)
                )
            );
        assertFalse(transferred);
        assertTrue(registry.getBadge(badge).issued);
        assertEq(round.getInstallations(id).length, 12);
        assertEq(round.getSum(id, 1).E, _sum(12, 1).E);
    }

    function testPairOneThree() public {
        _roundTrip(12, 1, 3);
    }

    function testPairTwoThree() public {
        _roundTrip(12, 2, 3);
    }

    function testFuzzCohortsAndPairs(uint8 count, uint8 pair) public {
        count = uint8(bound(count, 5, 12));
        pair %= 3;
        _roundTrip(count, pair == 2 ? 2 : 1, pair == 0 ? 2 : 3);
    }

    function testSmallCohortRevertAndSeparateAbort() public {
        _commit(4);
        round.startSharing(id);
        vm.expectRevert(R.CohortTooSmall.selector);
        round.startClosing(id);
        assertEq(uint256(round.getRound(id).state), uint256(R.State.Sharing));
        round.abort(id, keccak256("CohortTooSmall"));
        assertEq(uint256(round.getRound(id).state), uint256(R.State.Aborted));
        vm.expectRevert();
        round.abort(id, bytes32(0));
    }

    function testUnknownVerifierAndPQHashSubstitution() public {
        Submission memory x = _load(0);
        x.verifierSignature = vm.parseJsonBytes(json, _path(0, "foreignSignature"));
        vm.expectRevert(R.UnknownVerifier.selector);
        _submit(x);
        x = _load(0);
        x.pqSignatureHash = keccak256("SIMULATED replaced PQ hash");
        vm.expectRevert(R.UnknownVerifier.selector);
        _submit(x);
        x = _load(0);
        x.verifierSignature = hex"00";
        vm.expectRevert(R.UnknownVerifier.selector);
        _submit(x);
        _submit(_load(0));
        assertEq(round.getRound(id).n, 1);
    }

    function testDuplicateCohortAndMetadataChecks() public {
        Submission memory x = _load(0);
        _submit(x);
        vm.expectRevert(R.AlreadyCommitted.selector);
        _submit(x);
        x = _load(1);
        x.statement.installationId = keccak256("SIMULATED outsider");
        vm.expectRevert(R.NotInCohort.selector);
        _submit(x);
        x = _load(1);
        x.validationHash = keccak256("SIMULATED changed review");
        vm.expectRevert(R.InvalidMetadata.selector);
        _submit(x);
        x = _load(1);
        x.ciphertextHashes[0] = bytes32(0);
        x.statement.metadataHash = round.metadataDigest(x.validationHash, x.ciphertextHashes);
        x = _resign(x);
        vm.expectRevert(R.InvalidMetadata.selector);
        _submit(x);
        x = _load(1);
        x.validationHash = bytes32(0);
        vm.expectRevert(R.InvalidParams.selector);
        _submit(x);
    }

    function testIncomingPointsAndInvalidRealProof() public {
        Submission memory x = _load(0);
        x.statement.CE = B.Point(Q, 1);
        x = _resign(x);
        vm.expectRevert(B.NonCanonicalPoint.selector);
        _submit(x);
        x = _load(0);
        x.statement.CE = B.Point(1, 1);
        x = _resign(x);
        vm.expectRevert(B.NotOnCurve.selector);
        _submit(x);
        x = _load(0);
        x.statement.CE = B.Point(0, Q - 1);
        x = _resign(x);
        vm.expectRevert(B.NotInSubgroup.selector);
        _submit(x);
        x = _load(0);
        x.proof.a[0] = 1;
        vm.expectRevert(R.InvalidProof.selector);
        _submit(x);
    }

    function testReceiptErrorsAndCommonPairRequirement() public {
        _commit(5);
        round.startSharing(id);
        Submission memory x = _load(0);
        vm.expectRevert(R.WrongTrustee.selector);
        round.acknowledge(id, x.statement.installationId, 1, x.ciphertextHashes[0]);
        vm.prank(vm.addr(2));
        vm.expectRevert(R.UnknownPlant.selector);
        round.acknowledge(id, bytes32(0), 1, x.ciphertextHashes[0]);
        vm.prank(vm.addr(2));
        vm.expectRevert(R.WrongCiphertext.selector);
        round.acknowledge(id, x.statement.installationId, 1, bytes32(0));
        _ack(5, 1);
        vm.prank(vm.addr(2));
        vm.expectRevert(R.AlreadyAcknowledged.selector);
        round.acknowledge(id, x.statement.installationId, 1, x.ciphertextHashes[0]);
        _ack(4, 2);
        _ack(1, 3);
        vm.expectRevert(R.MissingReceipts.selector);
        round.startClosing(id);
        x = _load(4);
        vm.prank(vm.addr(3));
        round.acknowledge(id, x.statement.installationId, 2, x.ciphertextHashes[1]);
        round.startClosing(id);
        bytes32 manifest = round.getRound(id).manifestHash;
        T.Sum memory sums = _sum(5, 3);
        vm.prank(vm.addr(4));
        vm.expectRevert(R.MissingReceipts.selector);
        round.publishSum(id, 3, manifest, sums);
        vm.expectRevert(R.InsufficientSums.selector);
        round.close(id);
    }

    function testDroppedPlantAndAuthenticatedFaultEvidence() public {
        _prepare(12, 2, 3);
        bytes32 manifest = round.getRound(id).manifestHash;
        // Trustee 1 has not acknowledged: rejection is availability, not a false blame.
        vm.prank(vm.addr(2));
        vm.expectRevert(R.MissingReceipts.selector);
        round.publishSum(id, 1, manifest, _sum(11, 1));
        T.Sum memory bad = _sum(11, 2);
        vm.prank(vm.addr(3));
        vm.expectRevert(abi.encodeWithSelector(R.AggregateMismatch.selector, uint8(2)));
        round.publishSum(id, 2, manifest, bad);
        bytes memory signature = _signature(3, round.sumDigest(id, 2, manifest, bad));
        round.recordFault(id, 2, manifest, bad, signature);
        assertEq(round.getRound(id).faultMask, 2);
        bytes memory forged = _signature(99, round.sumDigest(id, 2, manifest, bad));
        vm.expectRevert(R.WrongTrustee.selector);
        round.recordFault(id, 2, manifest, bad, forged);
        vm.expectRevert(R.WrongTrustee.selector);
        round.recordFault(id, 4, manifest, bad, signature);
        vm.expectRevert(R.WrongManifest.selector);
        round.recordFault(id, 2, bytes32(0), bad, signature);
        T.Sum memory good = _sum(12, 2);
        signature = _signature(3, round.sumDigest(id, 2, manifest, good));
        vm.expectRevert(R.InvalidParams.selector);
        round.recordFault(id, 2, manifest, good, signature);
        _publish(12, 2);
        _publish(12, 3);
        round.close(id);
        assertEq(round.getRound(id).SE, 10560);
    }

    function testPublicationGuards() public {
        _prepare(5, 1, 2);
        T.Sum memory sum = _sum(5, 1);
        bytes32 manifest = round.getRound(id).manifestHash;
        vm.expectRevert(R.WrongTrustee.selector);
        round.publishSum(id, 1, manifest, sum);
        vm.prank(vm.addr(2));
        vm.expectRevert(R.WrongManifest.selector);
        round.publishSum(id, 1, bytes32(0), sum);
        T.Sum memory invalid = sum;
        invalid.E = L;
        vm.prank(vm.addr(2));
        vm.expectRevert(abi.encodeWithSelector(R.AggregateMismatch.selector, uint8(1)));
        round.publishSum(id, 1, manifest, invalid);
        _publish(5, 1);
        vm.prank(vm.addr(2));
        vm.expectRevert(R.AlreadyPublished.selector);
        round.publishSum(id, 1, manifest, sum);
    }

    function testBadgeRejections() public {
        _roundTrip(12, 1, 2);
        bytes32 installation = _load(0).statement.installationId;
        vm.expectRevert(BadgeRegistry.WrongRound.selector);
        registry.attest(id, 0, installation, 0, _badge("below"));
        vm.expectRevert(BadgeRegistry.UnknownPlant.selector);
        registry.attest(id, id, bytes32(0), 0, _badge("below"));
        vm.expectRevert(R.InvalidParams.selector);
        registry.attest(id, id, installation, 2, _badge("below"));
        vm.expectRevert(BadgeRegistry.InvalidProof.selector);
        registry.attest(id, id, _load(11).statement.installationId, 0, _badge("below"));
        vm.expectRevert(BadgeRegistry.InvalidProof.selector);
        registry.attest(id, id, installation, 1, _badge("below"));
        registry.attest(id, id, installation, 0, _badge("below"));
        vm.expectRevert(BadgeRegistry.AlreadyBadged.selector);
        registry.attest(id, id, installation, 0, _badge("below"));
        assertFalse(registry.getBadge(bytes32(0)).issued);
    }

    function testPreviousRoundProofReplayAndBadSectorAttestation() public {
        _roundTrip(12, 1, 2);
        T.Proof memory oldProof = _badge("below");
        json = _fixtures(2);
        R.Config memory cfg = _config(json);
        cfg.sectorProduction = 1;
        id = round.createRound(cfg);
        round.open(id);
        _prepare(12, 1, 2);
        _publish(12, 1);
        _publish(12, 2);
        vm.expectRevert(R.InvalidSectorProduction.selector);
        round.close(id);
        vm.expectRevert(BadgeRegistry.WrongRound.selector);
        registry.attest(id, 1, _load(0).statement.installationId, 0, oldProof);
        round.abort(id, keccak256("SIMULATED false sector denominator"));
    }

    function testAuthorizationStateAndParameterGuards() public {
        R.Config memory cfg = _config(json);
        vm.prank(address(77));
        vm.expectRevert(R.Unauthorized.selector);
        round.createRound(cfg);
        vm.expectRevert(R.UnknownRound.selector);
        round.getRound(0);
        vm.expectRevert(abi.encodeWithSelector(R.WrongState.selector, R.State.Draft, R.State.Open));
        round.open(id);
        cfg.minimumPlants = 4;
        vm.expectRevert(R.InvalidParams.selector);
        round.createRound(cfg);
        cfg = _config(json);
        cfg.trustees[1] = cfg.trustees[0];
        vm.expectRevert(R.InvalidParams.selector);
        round.createRound(cfg);
        cfg = _config(json);
        cfg.thresholdDenominators[0] = 0;
        vm.expectRevert(R.InvalidParams.selector);
        round.createRound(cfg);
        cfg = _config(json);
        cfg.encryptionKeys[0] = 0;
        vm.expectRevert(R.InvalidParams.selector);
        round.createRound(cfg);
        Submission memory x = _load(0);
        x.statement.roundId = uint256(type(uint64).max) + 1;
        vm.expectRevert(R.UnknownRound.selector);
        _submit(x);
    }

    function testDeadlineAndConstructorGuards() public {
        R.Config memory cfg = _config(json);
        uint64 draft = round.createRound(cfg);
        vm.warp(cfg.commitDeadline + 1);
        vm.expectRevert(R.DeadlinePassed.selector);
        round.open(draft);
        Submission memory x = _load(0);
        vm.expectRevert(R.DeadlinePassed.selector);
        _submit(x);
        round.startSharing(id);
        vm.warp(cfg.sharingDeadline + 1);
        vm.prank(vm.addr(2));
        vm.expectRevert(R.DeadlinePassed.selector);
        round.acknowledge(id, bytes32(0), 1, bytes32(0));
        vm.expectRevert(R.InvalidParams.selector);
        new R(address(0), address(validityVerifier));
        vm.expectRevert(R.InvalidParams.selector);
        new R(address(this), address(belowVerifier));
        vm.expectRevert(BadgeRegistry.InvalidParams.selector);
        new BadgeRegistry(address(0), address(belowVerifier));
        vm.expectRevert(BadgeRegistry.InvalidParams.selector);
        new BadgeRegistry(address(round), address(validityVerifier));
    }

    function testClosingDeadlinesAndFrozenStates() public {
        _commit(5);
        round.startSharing(id);
        _ack(5, 1);
        _ack(5, 2);
        uint64 deadline = round.getRound(id).config.closingDeadline;
        vm.warp(deadline + 1);
        vm.expectRevert(R.DeadlinePassed.selector);
        round.startClosing(id);
        vm.warp(deadline);
        round.startClosing(id);
        vm.warp(deadline + 1);
        T.Sum memory sum = _sum(5, 1);
        bytes32 manifest = round.getRound(id).manifestHash;
        vm.prank(vm.addr(2));
        vm.expectRevert(R.DeadlinePassed.selector);
        round.publishSum(id, 1, manifest, sum);
    }
}
