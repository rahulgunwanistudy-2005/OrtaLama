pragma circom 2.1.6;
include "lib/opening.circom";
include "circomlib/circuits/poseidon.circom";

template BelowThreshold() {
    signal input CE[2]; signal input CP[2];
    signal input thresholdNum; signal input thresholdDen;
    signal input roundId; signal input installationHi; signal input installationLo;
    signal input thresholdId; signal input chainId; signal input contractAddress;
    signal input contextTag;
    signal input E; signal input r; signal input P; signal input s;

    component eOpen = Opening(48); eOpen.value <== E; eOpen.blinding <== r;
    component pOpen = Opening(48); pOpen.value <== P; pOpen.blinding <== s;
    for (var i = 0; i < 2; i++) { CE[i] === eOpen.C[i]; CP[i] === pOpen.C[i]; }
    component positiveP = IsZero(); positiveP.in <== P; positiveP.out === 0;
    component nBits = Num2Bits(56); nBits.in <== thresholdNum;
    component dBits = Num2Bits(56); dBits.in <== thresholdDen;
    component positiveD = IsZero(); positiveD.in <== thresholdDen; positiveD.out === 0;
    signal left; signal right;
    left <== E * thresholdDen;
    right <== thresholdNum * P;
    component below = LessEqThan(128);
    below.in[0] <== left; below.in[1] <== right; below.out === 1;
    component bounds = ContextRanges();
    bounds.roundId <== roundId; bounds.installationHi <== installationHi;
    bounds.installationLo <== installationLo; bounds.chainId <== chainId;
    bounds.contractAddress <== contractAddress;
    component tid = Num2Bits(64); tid.in <== thresholdId;
    component context = Poseidon(13);
    context.inputs[0] <== 2;
    context.inputs[1] <== CE[0]; context.inputs[2] <== CE[1];
    context.inputs[3] <== CP[0]; context.inputs[4] <== CP[1];
    context.inputs[5] <== thresholdNum; context.inputs[6] <== thresholdDen;
    context.inputs[7] <== roundId; context.inputs[8] <== installationHi;
    context.inputs[9] <== installationLo; context.inputs[10] <== thresholdId;
    context.inputs[11] <== chainId; context.inputs[12] <== contractAddress;
    context.out === contextTag;
}
component main { public [CE, CP, thresholdNum, thresholdDen, roundId, installationHi, installationLo, thresholdId, chainId, contractAddress, contextTag] } = BelowThreshold();
