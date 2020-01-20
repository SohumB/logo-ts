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
        ctx.lineTo(
            state.pos.x + this.pixels * Math.sin(degrees),
            state.pos.y + this.pixels * Math.cos(degrees));
        ctx.stroke();

        return state;
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
