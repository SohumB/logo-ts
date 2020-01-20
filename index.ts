import { createCanvas, CanvasRenderingContext2D } from 'canvas';
import * as fs from 'fs';
import { parseProgram } from './parser';

const width = 400;
const height = 400;

const program = "fd 200 fd 200";
const canvas = createCanvas(width, height);
const ctx: CanvasRenderingContext2D = canvas.getContext('2d');

let ast = parseProgram(program);
if (ast != null) {
    ast.result.eval(ctx, {
        pos: { x: 200, y: 300 },
        heading: 200
    });
}

fs.writeFileSync('out.png', canvas.toBuffer())
