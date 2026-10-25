// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {BabyJubjub as B} from "./BabyJubjub.sol";
import {ProtocolTypes as T, ICommitmentValidityVerifier} from "./ProtocolTypes.sol";
import {CommitmentValidityVerifier} from "./CommitmentValidityVerifier.sol";

/// @notice Immutable, multi-round evidence protocol. No claim about physical report truth.
contract OrtalamaRound is EIP712 {
    enum State {
        Draft,
        Open,
        Sharing,
        Closing,
        Closed,
        Aborted
    }

    struct Config {
        bytes8 productCN;
        bytes2 country;
        uint32 period;
        bytes32 cohortRoot;
        bytes32 verifierRoot;
        address[3] trustees;
        bytes32[3] encryptionKeys;
        uint64 commitDeadline;
        uint64 sharingDeadline;
        uint64 closingDeadline;
        uint16 minimumPlants;
        uint56 sectorProduction;
        bytes32 sectorAttestationHash;
        bytes32 metadataHash;
        uint56[3] thresholdNumerators;
        uint56[3] thresholdDenominators;
        uint8 fixedThresholdCount;
        bool simulated;
    }

    struct Round {
        Config config;
        State state;
        uint16 n;
        uint16[3] receipts;
        uint8 publicationMask;
        uint8 faultMask;
        bytes32 manifestHash;
        B.Point sumCE;
        B.Point sumCP;
        B.Point sumAE;
        B.Point sumAP;
        uint56 SE;
        uint56 SP;
        uint256 intensity;
        uint256 coveragePpm;
        bool representative;
    }

    struct Plant {
        T.Statement statement;
        bytes32[3] ciphertextHashes;
        uint8 receipts;
        bool committed;
        bytes32 pqSignatureHash;
    }
    address public immutable regulator;
    ICommitmentValidityVerifier public immutable inputVerifier;
    uint64 public roundCount;
    mapping(uint64 => Round) private rounds;
    mapping(uint64 => mapping(bytes32 => Plant)) private plants;
    mapping(uint64 => bytes32[]) private installations;
    mapping(uint64 => mapping(uint8 => T.Sum)) private publications;
    uint256 private constant L = 2736030358979909402780800718157159386076813972158567259200215660948447373041;
    bytes32 public constant STATEMENT_TYPEHASH = keccak256(
        "PlantStatement(uint256 roundId,bytes32 installationId,uint256 CEx,uint256 CEy,uint256 CPx,uint256 CPy,uint256 AEx,uint256 AEy,uint256 APx,uint256 APy,bytes32 reportHash,bytes32 metadataHash,bytes32 pqKeyHash)"
    );
    bytes32 public constant PQ_LINK_TYPEHASH = keccak256("PQLink(bytes32 statementDigest,bytes32 pqSignatureHash)");
    bytes32 public constant SUM_TYPEHASH = keccak256(
        "TrusteeSum(uint64 roundId,uint8 trusteeIndex,bytes32 manifestHash,uint256 E,uint256 r,uint256 P,uint256 s)"
    );
    error Unauthorized();
    error UnknownRound();
    error InvalidParams();
    error WrongState(State expected, State actual);
    error DeadlinePassed();
    error NotInCohort();
    error UnknownVerifier();
    error AlreadyCommitted();
    error InvalidProof();
    error InvalidMetadata();
    error UnknownPlant();
    error WrongTrustee();
    error AlreadyAcknowledged();
    error WrongCiphertext();
    error CohortTooSmall();
    error MissingReceipts();
    error WrongManifest();
    error AlreadyPublished();
    error AggregateMismatch(uint8 trusteeIndex);
    error InsufficientSums();
    error InvalidSectorProduction();
    event RoundCreated(uint64 indexed roundId, bytes32 parametersHash, bool simulated);
    event StateChanged(uint64 indexed roundId, State state);
    event PlantCommitted(
        uint64 indexed roundId,
        bytes32 indexed installationId,
        address indexed verifier,
        T.Statement statement,
        bytes32[3] ciphertextHashes,
        bytes32 pqSignatureHash
    );
    event ShareAcknowledged(
        uint64 indexed roundId, bytes32 indexed installationId, uint8 indexed trusteeIndex, bytes32 ciphertextHash
    );
    event ManifestFrozen(uint64 indexed roundId, bytes32 manifestHash);
    event SumPublished(uint64 indexed roundId, uint8 indexed trusteeIndex, T.Sum sums, bytes32 manifestHash);
    event TrusteeFaultRecorded(uint64 indexed roundId, uint8 indexed trusteeIndex, bytes32 evidenceHash);
    event RoundClosed(
        uint64 indexed roundId,
        uint56 SE,
        uint56 SP,
        uint256 intensity,
        uint256 coveragePpm,
        bool representative,
        uint8 pairMask
    );
    event RoundAborted(uint64 indexed roundId, bytes32 reason);

    constructor(address regulator_, address verifier_) EIP712("Ortalama", "2") {
        if (
            regulator_ == address(0) || verifier_.codehash != keccak256(type(CommitmentValidityVerifier).runtimeCode)
                || block.chainid > type(uint64).max
        ) revert InvalidParams();
        regulator = regulator_;
        inputVerifier = ICommitmentValidityVerifier(verifier_);
    }
    modifier onlyRegulator() {
        if (msg.sender != regulator) revert Unauthorized();
        _;
    }

    function _round(uint64 id) private view returns (Round storage r) {
        if (id == 0 || id > roundCount) revert UnknownRound();
        return rounds[id];
    }

    function _state(Round storage r, State expected) private view {
        if (r.state != expected) revert WrongState(expected, r.state);
    }

    function _trustee(Round storage r, uint8 index) private view {
        if (index < 1 || index > 3 || r.config.trustees[index - 1] != msg.sender) revert WrongTrustee();
    }

    function createRound(Config calldata config) external onlyRegulator returns (uint64 id) {
        if (
            config.cohortRoot == bytes32(0) || config.verifierRoot == bytes32(0) || config.productCN == bytes8(0)
                || config.country == bytes2(0) || config.minimumPlants < 5 || config.minimumPlants > 256
                || config.sectorProduction == 0 || config.sectorAttestationHash == bytes32(0)
                || config.commitDeadline <= block.timestamp || config.sharingDeadline <= config.commitDeadline
                || config.closingDeadline <= config.sharingDeadline || config.fixedThresholdCount > 3
        ) revert InvalidParams();
        for (uint256 i; i < 3; ++i) {
            if (config.trustees[i] == address(0) || config.encryptionKeys[i] == bytes32(0)) revert InvalidParams();
            for (uint256 j; j < i; ++j) {
                if (config.trustees[i] == config.trustees[j] || config.encryptionKeys[i] == config.encryptionKeys[j]) {
                    revert InvalidParams();
                }
            }
            if (i < config.fixedThresholdCount && config.thresholdDenominators[i] == 0) revert InvalidParams();
        }
        id = ++roundCount;
        Round storage r = rounds[id];
        r.config = config;
        r.sumCE = B.identity();
        r.sumCP = B.identity();
        r.sumAE = B.identity();
        r.sumAP = B.identity();
        r.manifestHash = keccak256(abi.encode(block.chainid, address(this), id, config));
        emit RoundCreated(id, r.manifestHash, config.simulated);
        emit StateChanged(id, State.Draft);
    }

    function open(uint64 id) external onlyRegulator {
        Round storage r = _round(id);
        _state(r, State.Draft);
        if (block.timestamp > r.config.commitDeadline) revert DeadlinePassed();
        r.state = State.Open;
        emit StateChanged(id, State.Open);
    }

    function statementDigest(T.Statement memory s) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    STATEMENT_TYPEHASH,
                    s.roundId,
                    s.installationId,
                    s.CE.x,
                    s.CE.y,
                    s.CP.x,
                    s.CP.y,
                    s.AE.x,
                    s.AE.y,
                    s.AP.x,
                    s.AP.y,
                    s.reportHash,
                    s.metadataHash,
                    s.pqKeyHash
                )
            )
        );
    }

    function metadataDigest(bytes32 validationHash, bytes32[3] memory ciphertextHashes) public pure returns (bytes32) {
        return keccak256(abi.encode(validationHash, ciphertextHashes));
    }

    function pqLinkDigest(bytes32 digest, bytes32 pqSignatureHash) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(PQ_LINK_TYPEHASH, digest, pqSignatureHash)));
    }

    function commit(
        T.Statement calldata s,
        bytes32 validationHash,
        bytes32[3] calldata ciphertextHashes,
        bytes calldata verifierSignature,
        bytes calldata pqLinkSignature,
        bytes32 pqSignatureHash,
        bytes32[] calldata cohortProof,
        bytes32[] calldata verifierProof,
        T.Proof calldata proof
    ) external {
        if (s.roundId > type(uint64).max) revert UnknownRound();
        uint64 id = uint64(s.roundId);
        Round storage r = _round(id);
        _state(r, State.Open);
        if (block.timestamp > r.config.commitDeadline) revert DeadlinePassed();
        if (plants[id][s.installationId].committed) revert AlreadyCommitted();
        if (r.n >= 256 || s.reportHash == bytes32(0) || validationHash == bytes32(0) || pqSignatureHash == bytes32(0)) {
            revert InvalidParams();
        }
        if (!MerkleProof.verifyCalldata(
                cohortProof, r.config.cohortRoot, keccak256(bytes.concat(keccak256(abi.encode(s.installationId))))
            )) revert NotInCohort();
        bytes32 digest = statementDigest(s);
        (address signer, ECDSA.RecoverError error,) = ECDSA.tryRecover(digest, verifierSignature);
        if (
            error != ECDSA.RecoverError.NoError
                || !MerkleProof.verifyCalldata(
                    verifierProof,
                    r.config.verifierRoot,
                    keccak256(bytes.concat(keccak256(abi.encode(signer, s.pqKeyHash))))
                )
        ) revert UnknownVerifier();
        bytes32 link = pqLinkDigest(digest, pqSignatureHash);
        (address linkSigner, ECDSA.RecoverError linkError,) = ECDSA.tryRecover(link, pqLinkSignature);
        if (linkError != ECDSA.RecoverError.NoError || linkSigner != signer) revert UnknownVerifier();
        if (s.metadataHash != metadataDigest(validationHash, ciphertextHashes)) revert InvalidMetadata();
        for (uint256 i; i < 3; ++i) {
            if (ciphertextHashes[i] == bytes32(0)) revert InvalidMetadata();
        }
        B.validate(s.CE);
        B.validate(s.CP);
        B.validate(s.AE);
        B.validate(s.AP);
        uint256[14] memory inputs = [
            s.CE.x,
            s.CE.y,
            s.CP.x,
            s.CP.y,
            s.AE.x,
            s.AE.y,
            s.AP.x,
            s.AP.y,
            uint256(id),
            uint256(s.installationId) >> 128,
            uint256(uint128(uint256(s.installationId))),
            block.chainid,
            uint256(uint160(address(this))),
            proof.contextTag
        ];
        // Engineering gas cap: malformed precompile inputs must not consume an
        // unbounded relayer allowance. Monad testnet measured valid at 1.5M;
        // 2M allows headroom for its repriced BN254 precompiles.
        if (!inputVerifier.verifyProof{gas: 2_000_000}(proof.a, proof.b, proof.c, inputs)) revert InvalidProof();
        Plant storage p = plants[id][s.installationId];
        p.statement = s;
        p.ciphertextHashes = ciphertextHashes;
        p.committed = true;
        p.pqSignatureHash = pqSignatureHash;
        installations[id].push(s.installationId);
        ++r.n;
        r.sumCE = B.add(r.sumCE, s.CE);
        r.sumCP = B.add(r.sumCP, s.CP);
        r.sumAE = B.add(r.sumAE, s.AE);
        r.sumAP = B.add(r.sumAP, s.AP);
        r.manifestHash = keccak256(abi.encode(r.manifestHash, s, ciphertextHashes, pqSignatureHash));
        emit PlantCommitted(id, s.installationId, signer, s, ciphertextHashes, pqSignatureHash);
    }

    function startSharing(uint64 id) external onlyRegulator {
        Round storage r = _round(id);
        _state(r, State.Open);
        if (block.timestamp > r.config.sharingDeadline) revert DeadlinePassed();
        r.state = State.Sharing;
        emit StateChanged(id, State.Sharing);
    }

    function acknowledge(uint64 id, bytes32 installationId, uint8 index, bytes32 ciphertextHash) external {
        Round storage r = _round(id);
        _state(r, State.Sharing);
        _trustee(r, index);
        if (block.timestamp > r.config.sharingDeadline) revert DeadlinePassed();
        Plant storage p = plants[id][installationId];
        if (!p.committed) revert UnknownPlant();
        uint8 bit = uint8(1 << (index - 1));
        if ((p.receipts & bit) != 0) revert AlreadyAcknowledged();
        if (p.ciphertextHashes[index - 1] != ciphertextHash) revert WrongCiphertext();
        p.receipts |= bit;
        ++r.receipts[index - 1];
        emit ShareAcknowledged(id, installationId, index, ciphertextHash);
    }

    function startClosing(uint64 id) external onlyRegulator {
        Round storage r = _round(id);
        _state(r, State.Sharing);
        if (r.n < r.config.minimumPlants) revert CohortTooSmall();
        if (block.timestamp > r.config.closingDeadline) revert DeadlinePassed();
        uint8 available = 0;
        for (uint8 i; i < 3; ++i) {
            if (r.receipts[i] == r.n) ++available;
        }
        if (available < 2) revert MissingReceipts();
        r.state = State.Closing;
        emit ManifestFrozen(id, r.manifestHash);
        emit StateChanged(id, State.Closing);
    }

    function _consistent(Round storage r, uint8 index, T.Sum memory sums) private view returns (bool) {
        if (index < 1 || index > 3 || sums.E >= L || sums.r >= L || sums.P >= L || sums.s >= L) return false;
        return B.equal(B.commit(sums.E, sums.r), B.add(r.sumCE, B.multiply(r.sumAE, index)))
            && B.equal(B.commit(sums.P, sums.s), B.add(r.sumCP, B.multiply(r.sumAP, index)));
    }

    function publishSum(uint64 id, uint8 index, bytes32 manifestHash, T.Sum calldata sums) external {
        Round storage r = _round(id);
        _state(r, State.Closing);
        _trustee(r, index);
        if (block.timestamp > r.config.closingDeadline) revert DeadlinePassed();
        if (manifestHash != r.manifestHash) revert WrongManifest();
        uint8 bit = uint8(1 << (index - 1));
        if ((r.publicationMask & bit) != 0) revert AlreadyPublished();
        if (r.receipts[index - 1] != r.n) revert MissingReceipts();
        if (!_consistent(r, index, sums)) revert AggregateMismatch(index);
        publications[id][index] = sums;
        r.publicationMask |= bit;
        emit SumPublished(id, index, sums, manifestHash);
    }

    function sumDigest(uint64 id, uint8 index, bytes32 manifestHash, T.Sum memory sums) public view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(abi.encode(SUM_TYPEHASH, id, index, manifestHash, sums.E, sums.r, sums.P, sums.s))
            );
    }

    /// @notice Separate successful evidence transaction; a reverted publication cannot persist blame.
    function recordFault(uint64 id, uint8 index, bytes32 manifestHash, T.Sum calldata sums, bytes calldata signature)
        external
    {
        Round storage r = _round(id);
        _state(r, State.Closing);
        if (index < 1 || index > 3) revert WrongTrustee();
        if (manifestHash != r.manifestHash) revert WrongManifest();
        bytes32 digest = sumDigest(id, index, manifestHash, sums);
        (address signer, ECDSA.RecoverError error,) = ECDSA.tryRecover(digest, signature);
        if (error != ECDSA.RecoverError.NoError || signer != r.config.trustees[index - 1]) revert WrongTrustee();
        if (_consistent(r, index, sums)) revert InvalidParams();
        r.faultMask |= uint8(1 << (index - 1));
        emit TrusteeFaultRecorded(id, index, digest);
    }

    function _interpolate(uint256 a, uint256 b, uint8 x, uint8 y) private pure returns (uint256) {
        // Supported pairs only. Avoid a generic unchecked field inverse on-chain.
        if (x == 1 && y == 2) return addmod(mulmod(2, a, L), L - b, L);
        if (x == 1 && y == 3) return mulmod(addmod(mulmod(3, a, L), L - b, L), (L + 1) / 2, L);
        return addmod(mulmod(3, a, L), L - mulmod(2, b, L), L); // (2,3)
    }

    function close(uint64 id) external {
        Round storage r = _round(id);
        _state(r, State.Closing);
        bool candidateSeen = false;
        for (uint8 x = 1; x <= 2; ++x) {
            for (uint8 y = x + 1; y <= 3; ++y) {
                uint8 pair = uint8((1 << (x - 1)) | (1 << (y - 1)));
                if ((r.publicationMask & pair) != pair) continue;
                candidateSeen = true;
                T.Sum storage a = publications[id][x];
                T.Sum storage b = publications[id][y];
                T.Sum memory total = T.Sum(
                    _interpolate(a.E, b.E, x, y),
                    _interpolate(a.r, b.r, x, y),
                    _interpolate(a.P, b.P, x, y),
                    _interpolate(a.s, b.s, x, y)
                );
                if (
                    total.E >= 2 ** 56 || total.P == 0 || total.P >= 2 ** 56
                        || !B.equal(B.commit(total.E, total.r), r.sumCE)
                        || !B.equal(B.commit(total.P, total.s), r.sumCP)
                ) continue;
                if (total.P > r.config.sectorProduction) revert InvalidSectorProduction();
                r.SE = uint56(total.E);
                r.SP = uint56(total.P);
                r.intensity = total.E * 1_000_000 / total.P;
                r.coveragePpm = total.P * 1_000_000 / r.config.sectorProduction;
                r.representative =
                    5 * total.P >= 4 * uint256(r.config.sectorProduction) && r.n >= r.config.minimumPlants;
                r.state = State.Closed;
                emit RoundClosed(id, r.SE, r.SP, r.intensity, r.coveragePpm, r.representative, pair);
                emit StateChanged(id, State.Closed);
                return;
            }
        }
        if (candidateSeen) revert AggregateMismatch(0);
        revert InsufficientSums();
    }

    function abort(uint64 id, bytes32 reason) external onlyRegulator {
        Round storage r = _round(id);
        if (r.state == State.Closed || r.state == State.Aborted) revert WrongState(State.Sharing, r.state);
        r.state = State.Aborted;
        emit RoundAborted(id, reason);
        emit StateChanged(id, State.Aborted);
    }

    function getRound(uint64 id) external view returns (Round memory) {
        return _round(id);
    }

    function getPlant(uint64 id, bytes32 installationId) external view returns (Plant memory) {
        _round(id);
        return plants[id][installationId];
    }

    function getInstallations(uint64 id) external view returns (bytes32[] memory) {
        _round(id);
        return installations[id];
    }

    function getSum(uint64 id, uint8 index) external view returns (T.Sum memory) {
        _round(id);
        return publications[id][index];
    }

    function threshold(uint64 id, uint64 thresholdId) external view returns (uint256 numerator, uint256 denominator) {
        Round storage r = _round(id);
        _state(r, State.Closed);
        if (thresholdId > r.config.fixedThresholdCount) revert InvalidParams();
        if (thresholdId == 0) return (r.SE, r.SP);
        return (r.config.thresholdNumerators[thresholdId - 1], r.config.thresholdDenominators[thresholdId - 1]);
    }
}
