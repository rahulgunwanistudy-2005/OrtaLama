// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {Test} from "forge-std/Test.sol";
import {VmSafe} from "forge-std/Vm.sol";
import {BabyJubjub as B} from "../src/BabyJubjub.sol";

contract CurveHarness {
    function commit(uint256 value, uint256 blinding) external view returns (B.Point memory) {
        return B.commit(value, blinding);
    }

    function multiply(B.Point calldata p, uint256 n) external view returns (B.Point memory) {
        B.validate(p);
        return B.multiply(p, n);
    }

    function add(B.Point calldata p, B.Point calldata q) external view returns (B.Point memory) {
        B.validate(p);
        B.validate(q);
        return B.add(p, q);
    }

    function validate(B.Point calldata p) external view {
        B.validate(p);
    }

    function inverse(uint256 n) external view returns (uint256) {
        return B.inverseQ(n);
    }

    function generators() external pure returns (B.Point memory, B.Point memory) {
        return (B.generatorG(), B.generatorH());
    }
}

contract CurveTest is Test {
    uint256 private constant Q = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 private constant L = 2736030358979909402780800718157159386076813972158567259200215660948447373041;
    CurveHarness private curve;

    function setUp() public {
        curve = new CurveHarness();
    }

    function testIdentityAndCancellation() public view {
        (B.Point memory g, B.Point memory h) = curve.generators();
        assertTrue(B.equal(curve.commit(0, 0), B.identity()));
        assertTrue(B.equal(curve.multiply(g, 0), B.identity()));
        assertTrue(B.equal(curve.multiply(g, 1), g));
        assertTrue(B.equal(curve.add(g, curve.multiply(g, L - 1)), B.identity()));
        curve.validate(h);
        curve.validate(B.identity());
    }

    function testMalformedPointsAndScalar() public {
        vm.expectRevert(B.NonCanonicalPoint.selector);
        curve.validate(B.Point(Q, 1));
        vm.expectRevert(B.NotOnCurve.selector);
        curve.validate(B.Point(1, 1));
        vm.expectRevert(B.NotInSubgroup.selector);
        curve.validate(B.Point(0, Q - 1));
        vm.expectRevert(B.NonCanonicalScalar.selector);
        curve.commit(L, 0);
        vm.expectRevert(B.NonCanonicalScalar.selector);
        curve.commit(0, L);
        vm.expectRevert(B.InvalidInverse.selector);
        curve.inverse(0);
        vm.expectRevert(B.InvalidInverse.selector);
        curve.inverse(Q);
    }

    function testFuzzHomomorphism(uint256 av, uint256 bv, uint256 ar, uint256 br) public view {
        av %= L;
        bv %= L;
        ar %= L;
        br %= L;
        B.Point memory sum = curve.add(curve.commit(av, ar), curve.commit(bv, br));
        assertTrue(B.equal(sum, curve.commit(addmod(av, bv, L), addmod(ar, br, L))));
    }

    function testFuzzInverse(uint256 value) public view {
        value = bound(value, 1, Q - 1);
        assertEq(mulmod(value, curve.inverse(value), Q), 1);
    }

    function testDifferential224IndependentPythonVectors() public {
        string[] memory args = new string[](2);
        args[0] = ".venv/bin/python";
        args[1] = "packages/crypto-py/solidity_oracle.py";
        uint256[448] memory python = abi.decode(vm.ffi(args), (uint256[448]));
        string memory json = vm.readFile("data/simulated/SIMULATED_cross_language_vectors.json");
        for (uint256 i; i < 224; ++i) {
            string memory index = vm.toString(i);
            uint256 value = vm.parseJsonUint(json, string.concat(".vectors[", index, "].value"));
            uint256 blinding = vm.parseJsonUint(json, string.concat(".vectors[", index, "].blinding"));
            B.Point memory actual = curve.commit(value, blinding);
            assertEq(actual.x, python[2 * i]);
            assertEq(actual.y, python[2 * i + 1]);
            assertEq(actual.x, vm.parseJsonUint(json, string.concat(".expected[", index, "].commitment[0]")));
            assertEq(actual.y, vm.parseJsonUint(json, string.concat(".expected[", index, "].commitment[1]")));
        }
    }

    function testGasScalarMultiplication() public {
        (B.Point memory g,) = curve.generators();
        vm.startSnapshotGas("BabyJubjub", "validate-and-multiply");
        curve.multiply(g, L - 1);
        uint256 used = vm.stopSnapshotGas();
        // Coverage runs disable production optimisation and do not measure gas.
        if (!vm.isContext(VmSafe.ForgeContext.Coverage)) assertLt(used, 2_000_000);
    }
}
