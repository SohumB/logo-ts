import { createCanvas, CanvasRenderingContext2D } from 'canvas';
import * as fs from 'fs';
import { parseProgram } from './parser';

const width = 400;
const height = 400;

const program = "seth 0\n repeat 20 [fd 20 rt 20]";
const canvas = createCanvas(width, height);
const ctx: CanvasRenderingContext2D = canvas.getContext('2d');

let ast = parseProgram(program);
if (ast != null && ast.unparsed == '') {
    ast.result.eval(ctx, {
        pos: { x: 200, y: 300 },
        heading: 200
    });
}

fs.writeFileSync('out.png', canvas.toBuffer())
