// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Application curve arithmetic; not an independently audited contract.
/// Parameters and reference formulas: circomlibjs Baby Jubjub, source S12.
library BabyJubjub {
    uint256 internal constant Q = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 internal constant L = 2736030358979909402780800718157159386076813972158567259200215660948447373041;
    uint256 internal constant A = 168700;
    uint256 internal constant D = 168696;

    struct Point {
        uint256 x;
        uint256 y;
    }

    struct Extended {
        uint256 x;
        uint256 y;
        uint256 z;
        uint256 t;
    }
    error NonCanonicalPoint();
    error NotOnCurve();
    error NotInSubgroup();
    error NonCanonicalScalar();
    error InvalidInverse();

    function identity() internal pure returns (Point memory) {
        return Point(0, 1);
    }

    function generatorG() internal pure returns (Point memory) {
        return Point(
            5299619240641551281634865583518297030282874472190772894086521144482721001553,
            16950150798460657717958625567821834550301663161624707787222815936182638968203
        );
    }

    /// @dev Re-derived by TS/Python; see packages/crypto-ts/H.json.
    function generatorH() internal pure returns (Point memory) {
        return Point(
            17870749659966070127806348846592068818209476329184869328648696551031175258148,
            321508439340415863659414518833379152427209022265934291889629231814440712853
        );
    }

    function equal(Point memory p, Point memory r) internal pure returns (bool) {
        return p.x == r.x && p.y == r.y;
    }

    function onCurve(Point memory p) internal pure returns (bool) {
        if (p.x >= Q || p.y >= Q) return false;
        uint256 x2 = mulmod(p.x, p.x, Q);
        uint256 y2 = mulmod(p.y, p.y, Q);
        return addmod(mulmod(A, x2, Q), y2, Q) == addmod(1, mulmod(D, mulmod(x2, y2, Q), Q), Q);
    }

    function validate(Point memory p) internal view {
        if (p.x >= Q || p.y >= Q) revert NonCanonicalPoint();
        if (!onCurve(p)) revert NotOnCurve();
        if (!equal(_multiply(p, L), identity())) revert NotInSubgroup();
    }

    function scalar(uint256 n) internal pure {
        if (n >= L) revert NonCanonicalScalar();
    }

    function multiply(Point memory p, uint256 n) internal view returns (Point memory) {
        scalar(n);
        return _multiply(p, n);
    }

    /// @dev p/r must already have been validated or produced by this library.
    function add(Point memory p, Point memory r) internal view returns (Point memory) {
        return affine(addExtended(extend(p), extend(r)));
    }

    function commit(uint256 value, uint256 blinding) internal view returns (Point memory) {
        scalar(value);
        scalar(blinding);
        return add(_multiply(generatorG(), value), _multiply(generatorH(), blinding));
    }

    function extend(Point memory p) private pure returns (Extended memory) {
        return Extended(p.x, p.y, 1, mulmod(p.x, p.y, Q));
    }

    function addExtended(Extended memory p, Extended memory r) private pure returns (Extended memory out) {
        uint256 aa = mulmod(p.x, r.x, Q);
        uint256 bb = mulmod(p.y, r.y, Q);
        uint256 cc = mulmod(D, mulmod(p.t, r.t, Q), Q);
        uint256 dd = mulmod(p.z, r.z, Q);
        uint256 ee = addmod(mulmod(addmod(p.x, p.y, Q), addmod(r.x, r.y, Q), Q), Q - addmod(aa, bb, Q), Q);
        uint256 ff = addmod(dd, Q - cc, Q);
        uint256 gg = addmod(dd, cc, Q);
        uint256 hh = addmod(bb, Q - mulmod(A, aa, Q), Q);
        return Extended(mulmod(ee, ff, Q), mulmod(gg, hh, Q), mulmod(ff, gg, Q), mulmod(ee, hh, Q));
    }

    /// @dev Four-bit fixed-window multiplication in extended coordinates.
    function _multiply(Point memory p, uint256 n) private view returns (Point memory) {
        Extended[16] memory table;
        table[0] = Extended(0, 1, 1, 0);
        table[1] = extend(p);
        for (uint256 i = 2; i < 16; ++i) {
            table[i] = addExtended(table[i - 1], table[1]);
        }
        Extended memory result = table[0];
        for (uint256 window = 64; window > 0; --window) {
            for (uint256 j; j < 4; ++j) {
                result = addExtended(result, result);
            }
            uint256 digit = (n >> ((window - 1) * 4)) & 15;
            if (digit != 0) result = addExtended(result, table[digit]);
        }
        return affine(result);
    }

    function affine(Extended memory p) private view returns (Point memory) {
        uint256 inverse = inverseQ(p.z);
        return Point(mulmod(p.x, inverse, Q), mulmod(p.y, inverse, Q));
    }

    function inverseQ(uint256 value) internal view returns (uint256 result) {
        if (value == 0 || value >= Q) revert InvalidInverse();
        uint256[6] memory input = [uint256(32), 32, 32, value, Q - 2, Q];
        bool success;
        assembly ("memory-safe") {
            success := staticcall(gas(), 5, input, 0xc0, input, 0x20)
            result := mload(input)
        }
        if (!success || mulmod(value, result, Q) != 1) revert InvalidInverse();
    }
}
