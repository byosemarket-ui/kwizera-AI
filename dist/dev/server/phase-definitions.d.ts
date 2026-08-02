export interface PhaseDefinition {
    phase: number;
    id: string;
    name: string;
    engine: string;
    description: string;
    maxStep: string;
    certificationKey?: string;
}
export declare const PHASE_DEFINITIONS: PhaseDefinition[];
export declare const BLUEPRINT_STEPS: Array<{
    step: string;
    name: string;
    file: string;
}>;
//# sourceMappingURL=phase-definitions.d.ts.map