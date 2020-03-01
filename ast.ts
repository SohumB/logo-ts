import { CanvasRenderingContext2D } from 'canvas';

export interface ArithEnv {
    [name: string]: number
}

export interface FnEnv {
    [name: string]: Closure
}

interface Closure {
    vars: string[],
    body: Exp,
    arithEnv: ArithEnv
    fnEnv: FnEnv
}

export interface LogoState {
    pos: { x: number, y: number },
    heading: number,
    arithEnv: ArithEnv,
    fnEnv: FnEnv
}

type LogoRunning = LogoState & { terminated: boolean };

export interface AExp {
    eval: (env: ArithEnv) => number
}

export class Constant {
    constructor(readonly num: number) { }
    eval(_: ArithEnv): number {
        return this.num;
    }
}

export class Variable {
    constructor(readonly name: string) { }
    eval(env: ArithEnv): number {
        return env[this.name] || 0;
    }
}

export class Sub {
    constructor(readonly left: AExp, readonly right: AExp) { }
    eval(env: ArithEnv): number {
        return this.left.eval(env) - this.right.eval(env);
    }
}

export class Div {
    constructor(readonly left: AExp, readonly right: AExp) { }
    eval(env: ArithEnv): number {
        return this.left.eval(env) / this.right.eval(env);
    }
}

export interface BExp {
    eval: (env: ArithEnv) => boolean
}

export class Eq {
    constructor(readonly left: AExp, readonly right: AExp) { }
    eval(env: ArithEnv): boolean {
        return this.left.eval(env) == this.right.eval(env)
    }
}


export interface Exp {
    eval: (ctx: CanvasRenderingContext2D, state: LogoState) => LogoRunning
}

export class Forward implements Exp {
    constructor(readonly pixels: AExp) { }
    eval(ctx: CanvasRenderingContext2D, state: LogoState): LogoRunning {
        const degrees = state.heading * Math.PI / 180.0;
        ctx.lineWidth = 1;
        ctx.strokeStyle = "black";
        ctx.beginPath();
        ctx.moveTo(state.pos.x, state.pos.y);

        const pixels = this.pixels.eval(state.arithEnv);

        let newx = state.pos.x + pixels * Math.sin(degrees);
        let newy = state.pos.y + pixels * -Math.cos(degrees);
        ctx.lineTo(newx, newy);
        ctx.stroke();

        return { ...state, pos: { x: newx, y: newy }, terminated: false };
    }
}

export class Rotate implements Exp {
    constructor(readonly degrees: AExp) { }
    eval(_: CanvasRenderingContext2D, state: LogoState): LogoRunning {
        return {
            ...state,
            pos: state.pos,
            heading: state.heading + this.degrees.eval(state.arithEnv),
            terminated: false
        }
    }
}

export class SetHeading implements Exp {
    constructor(readonly degrees: AExp) { }
    eval(_: CanvasRenderingContext2D, state: LogoState): LogoRunning {
        return {
            ...state,
            pos: state.pos,
            heading: this.degrees.eval(state.arithEnv),
            terminated: false
        }
    }
}

export class Sequence implements Exp {
    constructor(readonly first: Exp, readonly second: Exp) { }
    eval(ctx: CanvasRenderingContext2D, state: LogoState): LogoRunning {
        let intermediateState = this.first.eval(ctx, state);
        if (intermediateState.terminated) { return intermediateState; }
        return this.second.eval(ctx, intermediateState);
    }
}

export class Repeat implements Exp {
    constructor(readonly times: AExp, readonly body: Exp) { }
    eval(ctx: CanvasRenderingContext2D, state: LogoState): LogoRunning {
        let currentState: LogoRunning = { ...state, terminated: false };
        const times = this.times.eval(state.arithEnv);
        for (let i = 0; i < times; i++) {
            currentState = this.body.eval(ctx, currentState)
            if (currentState.terminated) { break }
        }
        return currentState;
    }
}

export class Function implements Exp {
    constructor(
        readonly name: string,
        readonly vars: string[],
        readonly body: Exp) { }

    eval(_: CanvasRenderingContext2D, state: LogoState): LogoRunning {
        const closure = {
            vars: this.vars,
            body: this.body,
            arithEnv: {
                ...state.arithEnv
            },
            fnEnv: {
                ...state.fnEnv
            }
        };
        closure.fnEnv[this.name] = closure;

        const newEnv = { ...state.fnEnv };
        newEnv[this.name] = closure;

        return {
            ...state,
            fnEnv: newEnv,
            terminated: false
        }
    }
}

// let i = 0;
// function incr() { return i; }

// function zog() {
//     let i = 5;
//     incr();
// }

export class Call implements Exp {
    constructor(readonly name: string, readonly vars: AExp[]) { }

    eval(ctx: CanvasRenderingContext2D, state: LogoState): LogoRunning {
        let clos = state.fnEnv[this.name];
        // todo: runtime errors

        let callingArithEnv = { ...clos.arithEnv };
        clos.vars.map((name, i) => {
            callingArithEnv[name] = this.vars[i].eval(state.arithEnv)
        });

        let calledState = clos.body.eval(ctx, {
            ...state,
            arithEnv: callingArithEnv,
            fnEnv: clos.fnEnv
        });

        return {
            ...calledState,
            arithEnv: state.arithEnv,
            fnEnv: state.fnEnv,
            terminated: false
        };
    }
}

export class If implements Exp {
    constructor(readonly cond: BExp, readonly body: Exp) { }

    eval(ctx: CanvasRenderingContext2D, state: LogoState): LogoRunning {
        if (this.cond.eval(state.arithEnv)) {
            return this.body.eval(ctx, state);
        } else {
            return { ...state, terminated: false };
        }
    }
}

export class Stop implements Exp {
    constructor() { }

    eval(_: CanvasRenderingContext2D, st: LogoState): LogoRunning {
        return { ...st, terminated: true }
    }
}
