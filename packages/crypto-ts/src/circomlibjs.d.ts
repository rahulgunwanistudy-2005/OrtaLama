declare module 'circomlibjs' {
  export function buildBabyjub(): Promise<any>;
  export function buildPoseidon(): Promise<any>;
}
declare module 'snarkjs' {
  export const groth16: any;
  export const curves: any;
}
