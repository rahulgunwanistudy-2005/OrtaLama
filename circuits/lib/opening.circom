pragma circom 2.1.6;

include "circomlib/circuits/escalarmulfix.circom";
include "circomlib/circuits/comparators.circom";
include "generators.circom";

template ScalarBits() {
    signal input value;
    signal output bits[251];
    component binary = Num2Bits(251);
    binary.in <== value;
    component canonical = LessThan(251);
    canonical.in[0] <== value;
    canonical.in[1] <== 2736030358979909402780800718157159386076813972158567259200215660948447373041;
    canonical.out === 1;
    for (var i = 0; i < 251; i++) bits[i] <== binary.out[i];
}

template Opening(valueBits) {
    signal input value;
    signal input blinding;
    signal output C[2];
    component scalar = ScalarBits();
    scalar.value <== blinding;
    component valueBinary = Num2Bits(valueBits);
    valueBinary.in <== value;
    if (valueBits == 251) {
        component canonical = LessThan(251);
        canonical.in[0] <== value;
        canonical.in[1] <== 2736030358979909402780800718157159386076813972158567259200215660948447373041;
        canonical.out === 1;
    }
    component vG = EscalarMulFix(valueBits, generatorG());
    component rH = EscalarMulFix(251, generatorH());
    for (var i = 0; i < valueBits; i++) vG.e[i] <== valueBinary.out[i];
    for (var i = 0; i < 251; i++) rH.e[i] <== scalar.bits[i];
    component sum = BabyAdd();
    sum.x1 <== vG.out[0]; sum.y1 <== vG.out[1];
    sum.x2 <== rH.out[0]; sum.y2 <== rH.out[1];
    C[0] <== sum.xout; C[1] <== sum.yout;
}

template ContextRanges() {
    signal input roundId;
    signal input installationHi;
    signal input installationLo;
    signal input chainId;
    signal input contractAddress;
    component r = Num2Bits(64); r.in <== roundId;
    component hi = Num2Bits(128); hi.in <== installationHi;
    component lo = Num2Bits(128); lo.in <== installationLo;
    component chain = Num2Bits(64); chain.in <== chainId;
    component addr = Num2Bits(160); addr.in <== contractAddress;
}
