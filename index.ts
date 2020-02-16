import { createCanvas, CanvasRenderingContext2D } from 'canvas';
import * as fs from 'fs';
import { parseProgram } from './parser';

const width = 800;
const height = 400;

const program = "to fr :steps :degrees \nfd :steps \nrt :degrees end\n seth 0\n repeat 36 fr 20 10";
const canvas = createCanvas(width, height);
const ctx: CanvasRenderingContext2D = canvas.getContext('2d');

let ast = parseProgram(program);
if (ast != null && ast.unparsed == '') {
    ast.result.eval(ctx, {
        pos: { x: 200, y: 200 },
        heading: 200,
        arithEnv: {},
        fnEnv: {}
    });
}

fs.writeFileSync('out.png', canvas.toBuffer())
