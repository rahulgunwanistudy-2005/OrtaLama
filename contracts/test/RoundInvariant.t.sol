// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {RoundFixture} from "./Round.t.sol";
import {OrtalamaRound as R} from "../src/OrtalamaRound.sol";
import {ProtocolTypes as T} from "../src/ProtocolTypes.sol";

interface IDriver {
    function phase() external view returns (R.State);
    function commitDrive(uint8 index) external returns (uint256 E, uint256 P);
    function advanceDrive(uint16 mask) external;
    function publishDrive(uint16 mask, uint8 index, bool corrupt) external returns (bool);
    function closeDrive() external returns (bool);
}

/// @dev Random schedules/subsets of real, range-proven SIMULATED plants. No mock verifier.
contract RoundHandler {
    IDriver private immutable driver;
    uint16 public mask;
    uint8 public publicationMask;
    uint8 public n;
    uint256 public trueE;
    uint256 public trueP;
    bool public badPublicationAccepted;
    bool public validPublicationRejected;
    bool public wrongCloseOutcome;

    constructor(IDriver driver_) {
        driver = driver_;
    }

    function commit(uint8 index) public {
        index %= 12;
        if (driver.phase() != R.State.Open || (mask & uint16(1 << index)) != 0) return;
        (uint256 E, uint256 P) = driver.commitDrive(index);
        mask |= uint16(1 << index);
        ++n;
        trueE += E;
        trueP += P;
    }

    function advance(uint8 extra) external {
        if (driver.phase() != R.State.Open) return;
        // A random prefix of the missing members ensures meaningful closing
        // attempts rather than a test consisting entirely of premature reverts.
        for (uint8 i; i < 12 && n < 5 + extra % 8; ++i) {
            commit(i);
        }
        driver.advanceDrive(mask);
    }

    function publish(uint8 index) external {
        index = index % 3 + 1;
        if (driver.phase() != R.State.Closing || (publicationMask & uint8(1 << (index - 1))) != 0) return;
        if (driver.publishDrive(mask, index, false)) publicationMask |= uint8(1 << (index - 1));
        else validPublicationRejected = true;
    }

    function publishCorrupt(uint8 index) external {
        index = index % 3 + 1;
        if (driver.phase() != R.State.Closing || (publicationMask & uint8(1 << (index - 1))) != 0) return;
        if (driver.publishDrive(mask, index, true)) badPublicationAccepted = true;
    }

    function close() external {
        if (driver.phase() != R.State.Closing) return;
        uint8 publications;
        for (uint8 i; i < 3; ++i) {
            if ((publicationMask & uint8(1 << i)) != 0) ++publications;
        }
        if (driver.closeDrive() != (publications >= 2)) wrongCloseOutcome = true;
    }
}

contract RoundInvariantTest is RoundFixture, IDriver {
    RoundHandler private handler;

    function setUp() public override {
        super.setUp();
        handler = new RoundHandler(IDriver(address(this)));
        targetContract(address(handler));
        bytes4[] memory selectors = new bytes4[](5);
        selectors[0] = handler.commit.selector;
        selectors[1] = handler.advance.selector;
        selectors[2] = handler.publish.selector;
        selectors[3] = handler.publishCorrupt.selector;
        selectors[4] = handler.close.selector;
        targetSelector(FuzzSelector(address(handler), selectors));
    }
    modifier onlyHandler() {
        require(msg.sender == address(handler), "test driver only");
        _;
    }

    function phase() external view returns (R.State) {
        return round.getRound(id).state;
    }

    function commitDrive(uint8 index) external onlyHandler returns (uint256 E, uint256 P) {
        _submit(_load(index));
        return (vm.parseJsonUint(json, _path(index, "E")), vm.parseJsonUint(json, _path(index, "P")));
    }

    function advanceDrive(uint16 mask) external onlyHandler {
        round.startSharing(id);
        for (uint8 index = 1; index <= 3; ++index) {
            for (uint8 i; i < 12; ++i) {
                if ((mask & uint16(1 << i)) != 0) {
                    Submission memory x = _load(i);
                    vm.prank(vm.addr(uint256(index) + 1));
                    round.acknowledge(id, x.statement.installationId, index, x.ciphertextHashes[index - 1]);
                }
            }
        }
        round.startClosing(id);
    }

    function publishDrive(uint16 mask, uint8 index, bool corrupt) external onlyHandler returns (bool success) {
        T.Sum memory sum;
        for (uint8 i; i < 12; ++i) {
            if ((mask & uint16(1 << i)) != 0) {
                T.Sum memory share = abi.decode(
                    vm.parseJsonBytes(json, string.concat(_path(i, "shares"), "[", vm.toString(index - 1), "]")),
                    (T.Sum)
                );
                sum.E = addmod(sum.E, share.E, L);
                sum.r = addmod(sum.r, share.r, L);
                sum.P = addmod(sum.P, share.P, L);
                sum.s = addmod(sum.s, share.s, L);
            }
        }
        if (corrupt) sum.E = addmod(sum.E, 1, L);
        bytes32 manifest = round.getRound(id).manifestHash;
        vm.prank(vm.addr(uint256(index) + 1));
        (success,) = address(round).call(abi.encodeCall(round.publishSum, (id, index, manifest, sum)));
    }

    function closeDrive() external onlyHandler returns (bool success) {
        (success,) = address(round).call(abi.encodeCall(round.close, (id)));
    }

    function invariantOnlyTrueCommittedSumsCanClose() public view {
        R.Round memory result = round.getRound(id);
        assertFalse(handler.badPublicationAccepted());
        assertFalse(handler.validPublicationRejected());
        assertFalse(handler.wrongCloseOutcome());
        assertEq(result.n, handler.n());
        if (result.state == R.State.Closed) {
            assertEq(result.SE, handler.trueE());
            assertEq(result.SP, handler.trueP());
            assertEq(result.intensity, handler.trueE() * 1_000_000 / handler.trueP());
        }
    }
}
