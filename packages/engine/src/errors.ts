// The error classes of SPEC.md E-10, all extending EngineError (CONTRACTS.md 2.2).
// Each class sets `name` to its own class name so that the worker of phase 1 can re-throw
// "as the same class" from { name, message, data? }. Reaching a cap is never thrown.
//
// Admissibility and Reason are declared here (plan placement) because NotAdmissible carries one.

export interface Reason {
  code: 'not-a-symmetry' | 'not-an-involution' | 'moves-black-set' | 'differs-from-minus-wX' | 'not-an-integer';
  nodes: number[];
  value?: string;
}

export interface Admissibility {
  symmetry: boolean;
  condition_1: boolean;
  condition_2: boolean;
  condition_3: boolean;
  admissible: boolean;
  reasons: Record<string, Reason>;
}

export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineError';
  }
}

/** The matrix is not a board at all (E-8). */
export class NotABoard extends EngineError {
  constructor(message = 'not a board') {
    super(message);
    this.name = 'NotABoard';
  }
}

/** A function of the theory was called on a one-way board. */
export class NeedsTwoWayRoads extends EngineError {
  constructor(message = 'this function needs a board on which every road has a road back') {
    super(message);
    this.name = 'NeedsTwoWayRoads';
  }
}

/** cartanClass, identify or identifyAffine was given a board in several pieces. */
export class NeedsConnectedBoard extends EngineError {
  constructor(message = 'this function needs a connected board') {
    super(message);
    this.name = 'NeedsConnectedBoard';
  }
}

/** A function of the finite theory was called on a board that is not of finite type. */
export class NotFiniteType extends EngineError {
  constructor(message = 'this function needs a board of finite type') {
    super(message);
    this.name = 'NotFiniteType';
  }
}

/** marks, comarks or level was called on a board that is not affine; the class is in the message. */
export class NotAffine extends EngineError {
  readonly data: { class: 'finite' | 'indefinite' };
  constructor(cls: 'finite' | 'indefinite') {
    super(`this function needs an affine board; this board is ${cls}`);
    this.name = 'NotAffine';
    this.data = { class: cls };
  }
}

/** satake, satakeRecord or restrictedBoard on a pair that fails a condition; carries the record. */
export class NotAdmissible extends EngineError {
  readonly data: Admissibility;
  constructor(data: Admissibility, message = 'the pair is not admissible') {
    super(message);
    this.name = 'NotAdmissible';
    this.data = data;
  }
}

/** Thrown only by SafeInt when a result is not a safe integer. */
export class EngineOverflow extends EngineError {
  constructor(message = 'a result is not a safe integer') {
    super(message);
    this.name = 'EngineOverflow';
  }
}
