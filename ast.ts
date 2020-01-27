import { CanvasRenderingContext2D } from 'canvas';

export interface LogoState {
    pos: { x: number, y: number },
    heading: number
    // variables??
}

export interface Exp {
    eval: (ctx: CanvasRenderingContext2D, state: LogoState) => LogoState
}

export class Forward implements Exp {
    constructor(readonly pixels: number) { }
    eval(ctx: CanvasRenderingContext2D, state: LogoState): LogoState {
        const degrees = state.heading * Math.PI / 180.0;
        ctx.lineWidth = 10;
        ctx.strokeStyle = "black";
        ctx.beginPath();
        ctx.moveTo(state.pos.x, state.pos.y);

        let newx = state.pos.x + this.pixels * Math.sin(degrees);
        let newy = state.pos.y + this.pixels * -Math.cos(degrees);
        ctx.lineTo(newx, newy);
        ctx.stroke();

        return { ...state, pos: { x: newx, y: newy } };
    }
}

export class Rotate implements Exp {
    constructor(readonly degrees: number) { }
    eval(_: CanvasRenderingContext2D, state: LogoState): LogoState {
        return {
            pos: state.pos,
            heading: state.heading + this.degrees
        }
    }
}

export class SetHeading implements Exp {
    constructor(readonly degrees: number) { }
    eval(_: CanvasRenderingContext2D, state: LogoState): LogoState {
        return {
            pos: state.pos,
            heading: this.degrees
        }
    }
}

export class Sequence implements Exp {
    constructor(readonly first: Exp, readonly second: Exp) { }
    eval(ctx: CanvasRenderingContext2D, state: LogoState): LogoState {
        let intermediateState = this.first.eval(ctx, state);
        return this.second.eval(ctx, intermediateState);
    }
}

export class Repeat implements Exp {
    constructor(readonly times: number, readonly body: Exp) { }
    eval(ctx: CanvasRenderingContext2D, state: LogoState): LogoState {
        let currentState = state;
        for (let i = 0; i < this.times; i++) {
            currentState = this.body.eval(ctx, currentState)
        }
        return currentState;
    }
}
