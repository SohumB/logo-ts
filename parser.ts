import { Exp, Forward, Rotate, SetHeading } from './ast';

interface KnownParseResult<T> {
    unparsed: string,
    result: T
}

type ParseResult<T> = null | KnownParseResult<T>;

function map<A, B>(res: ParseResult<A>, f: (arg: A) => B): ParseResult<B> {
    if (res != null) {
        return {
            unparsed: res.unparsed,
            result: f(res.result)
        }
    } else {
        return null
    }
}

type Parser<T> = (input: string) => ParseResult<T>;

const parseDigit: Parser<string> =
    function(input: string): ParseResult<string> {
        if (input[0] >= '0' && input[0] <= '9') {
            return {
                unparsed: input.slice(1),
                result: input[0]
            }
        }
        return null;
    }

const parseSpace: Parser<null> =
    function(input: string): ParseResult<null> {
        if (input[0] == ' ') {
            return {
                unparsed: input.slice(1),
                result: null
            }
        }
        return null;
    }

const parseSpaces: Parser<null> =
    function(input: string): ParseResult<null> {
        return map(many(parseSpace)(input), _ => null);
    }

function many<T>(parser: Parser<T>): Parser<T[]> {
    return function(input: string): ParseResult<T[]> {
        let curParseResult = parser(input);
        let curInput = input;
        let result = [];
        while (curParseResult != null) {
            result.push(curParseResult.result);
            curInput = curParseResult.unparsed;
            curParseResult = parser(curParseResult.unparsed);
        }
        return {
            result: result,
            unparsed: curInput
        }
    }
}

function failOnEmpty<T>(parser: Parser<T[]>): Parser<T[]> {
    return function(input: string): ParseResult<T[]> {
        let res = parser(input);
        if (res && res.result.length == 0) { res = null; }
        return res;
    }
}

const parseNumber: Parser<number> = function(input) {
    let sts = failOnEmpty(many(parseDigit))(input);
    return map(sts, arr => parseInt(arr.join('')));
}

function parseCommand(command: string, fn: (px: number) => Exp): Parser<Exp> {
    const len = command.length;
    return function(input: string): ParseResult<Exp> {
        if (input.slice(0, len) == command) {
            const spaces = parseSpaces(input.slice(len));
            if (spaces != null) {
                const pixels = parseNumber(spaces.unparsed);
                return map(pixels, fn);
            }
            return null;
        }
        return null;
    };
}

function choice<T>(parsers: Parser<T>[]): Parser<T> {
    return function(input: string) {
        for (let p of parsers) {
            const res = p(input);
            if (res != null) { return res }
        }
        return null;
    }
}

function or<T>(parserA: Parser<T>, parserB: Parser<T>): Parser<T> {
    return choice([parserA, parserB]);
}

const parseFd: Parser<Exp> =
    parseCommand("fd", px => new Forward(px));
const parseRt: Parser<Exp> =
    parseCommand("rt", px => new Rotate(px));
const parseSeth: Parser<Exp> =
    parseCommand("seth", px => new SetHeading(px));


export const parseProgram = choice([
    parseFd,
    parseRt,
    parseSeth
]);
