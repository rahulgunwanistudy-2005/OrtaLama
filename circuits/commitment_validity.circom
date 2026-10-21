pragma circom 2.1.6;
include "lib/opening.circom";
include "circomlib/circuits/poseidon.circom";

template CommitmentValidity() {
    signal input CE[2]; signal input CP[2]; signal input AE[2]; signal input AP[2];
    signal input roundId; signal input installationHi; signal input installationLo;
    signal input chainId; signal input contractAddress; signal input contextTag;
    signal input E; signal input r; signal input P; signal input s;
    signal input aE; signal input ar; signal input aP; signal input as;
    component e = Opening(48); e.value <== E; e.blinding <== r;
    component p = Opening(48); p.value <== P; p.blinding <== s;
    component ae = Opening(251); ae.value <== aE; ae.blinding <== ar;
    component ap = Opening(251); ap.value <== aP; ap.blinding <== as;
    component positiveP = IsZero(); positiveP.in <== P; positiveP.out === 0;
    for (var i = 0; i < 2; i++) {
        CE[i] === e.C[i]; CP[i] === p.C[i]; AE[i] === ae.C[i]; AP[i] === ap.C[i];
    }
    component bounds = ContextRanges();
    bounds.roundId <== roundId; bounds.installationHi <== installationHi;
    bounds.installationLo <== installationLo; bounds.chainId <== chainId;
    bounds.contractAddress <== contractAddress;
    component context = Poseidon(14);
    context.inputs[0] <== 1;
    context.inputs[1] <== CE[0]; context.inputs[2] <== CE[1];
    context.inputs[3] <== CP[0]; context.inputs[4] <== CP[1];
    context.inputs[5] <== AE[0]; context.inputs[6] <== AE[1];
    context.inputs[7] <== AP[0]; context.inputs[8] <== AP[1];
    context.inputs[9] <== roundId; context.inputs[10] <== installationHi;
    context.inputs[11] <== installationLo; context.inputs[12] <== chainId;
    context.inputs[13] <== contractAddress;
    context.out === contextTag;
}
component main { public [CE, CP, AE, AP, roundId, installationHi, installationLo, chainId, contractAddress, contextTag] } = CommitmentValidity();
