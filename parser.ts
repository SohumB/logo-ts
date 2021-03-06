import {
    Exp,
    Forward,
    Rotate,
    SetHeading,
    Sequence,
    Repeat,
    Function,
    Call,
    If,
    Stop,
    AExp,
    Constant,
    Variable,
    Sub,
    Div,
    BExp,
    Eq,
} from './ast';

interface KnownParseResult<T> {
    unparsed: string,
    result: T
}
type ParseResult<T> = null | KnownParseResult<T>;
type Parser<T> = (input: string) => ParseResult<T>;

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

function pmap<A, B>(p: Parser<A>, f: (arg: A) => B): Parser<B> {
    return function(input: string) {
        let pRes = p(input);
        if (pRes == null) { return null; }

        return {
            result: f(pRes.result),
            unparsed: pRes.unparsed
        }
    }
}

// const parseSpaces: Parser<null> =
//     function(input: string): ParseResult<null> {
//         return map(many(parseSpace)(input), _ => null);
//     }

type RequireSpace = "require spaces" | "don't require spaces";
function lexeme<T>(
    parser: Parser<T>,
    requireSpace: RequireSpace = "require spaces"): Parser<T> {
    return function(input: string): ParseResult<T> {
        let afterParser = parser(input);
        if (afterParser == null) { return null };

        let spaceConsumer = many(parseSpace);
        if (requireSpace == "require spaces") {
            spaceConsumer = failOnEmpty(spaceConsumer);
        }
        let afterSpaces =
            spaceConsumer(afterParser.unparsed);
        return afterSpaces ? {
            unparsed: afterSpaces.unparsed,
            result: afterParser.result
        } : null;
    }
}

export function many<T>(parser: Parser<T>): Parser<T[]> {
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

export function binaryLeft<T, O>(
    baseParser: Parser<T>,
    opParser: Parser<O>,
    combine: (l: T, o: O, r: T) => T
): Parser<T> {
    return function(input: string): ParseResult<T> {
        let curParseResult = baseParser(input);
        if (curParseResult == null) { return null; }

        let curResult = curParseResult.result;
        let curInput = curParseResult.unparsed;

        while (true) {
            const opRes = opParser(curInput);
            if (opRes == null) { break; }

            curParseResult = baseParser(opRes.unparsed);
            if (curParseResult == null) { break; }

            curResult = combine(curResult, opRes.result, curParseResult.result);
            curInput = curParseResult.unparsed;
        }

        return {
            result: curResult,
            unparsed: curInput
        }
    }
}

// in our codebase binaryRight is only used for statements
// statements don't have syntax between them
// so this does not need an op
export function binaryRight<T>(
    baseParser: Parser<T>,
    combine: (l: T, r: T) => T
): Parser<T> {
    return function(input: string): ParseResult<T> {
        const start = baseParser(input);
        if (start == null) { return null; }

        const next = binaryRight(baseParser, combine)(start.unparsed);
        if (next == null) { return start; }

        return {
            result: combine(start.result, next.result),
            unparsed: next.unparsed
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

function satisfy(fn: (str: string) => boolean): Parser<string> {
    return function(input: string): ParseResult<string> {
        if (input.length < 1 || !fn(input[0])) {
            return null;
        } else {
            return {
                unparsed: input.slice(1),
                result: input[0]
            }
        }
    }
}

function span<T, U>(
    parser: Parser<T>,
    fn: (ts: T[]) => U,
    requireSpace: RequireSpace): Parser<U> {
    return lexeme(function(input) {
        let sts = failOnEmpty(many(parser))(input);
        return map(sts, arr => fn(arr));
    }, requireSpace)
}
const rws: string[] = ["to", "end", "if", "stop", "repeat", "fd", "rt", "seth"];

const parseSpace: Parser<string> =
    satisfy((str: string) => /\s/.test(str))

const parseDigit: Parser<string> =
    satisfy((str: string) => str >= '0' && str <= '9');

const parseNumber: Parser<number> =
    span(parseDigit, arr => parseInt(arr.join('')), "don't require spaces");

// str => str.isAlpha
const parseAlpha: Parser<string> =
    satisfy((str: string) => ((str >= 'A' && str <= 'Z') ||
        (str >= 'a' && str <= 'z')));

const parseWord: Parser<string> =
    span(parseAlpha, arr => arr.join(''), "don't require spaces");

const parseName: Parser<string> =
    span(parseAlpha, arr => arr.join(''), "require spaces");

const parseVar: Parser<string> = function(input: string) {
    const colonRes = satisfy((str: string) => str == ':')(input);
    if (colonRes == null) { return null; }

    const nameRes = parseWord(colonRes.unparsed);
    if (nameRes == null) { return null; }

    return nameRes;
}

const numParser: Parser<AExp> = pmap(parseNumber, num => new Constant(num));
const varParser: Parser<AExp> = pmap(parseVar, name => new Variable(name));

function parseOperation(op: string) {
    return lexeme(
        satisfy((str: string) => str == op),
        "don't require spaces"
    );
}

export const parseAExp: Parser<AExp> =
    binaryLeft(
        binaryLeft(
            choice([numParser, varParser]),
            parseOperation("/"),
            (l, _, r) => new Div(l, r)
        ),
        parseOperation("-"),
        (l, _, r) => new Sub(l, r)
    );

export const parseBExp: Parser<BExp> = function(input: string): ParseResult<BExp> {
    const left = parseAExp(input);
    if (left == null) { return null; }

    const op = parseOperation("=")(left.unparsed);
    if (op == null) { return null; }

    const right = parseAExp(op.unparsed);
    if (right == null) { return null; }

    return {
        result: new Eq(left.result, right.result),
        unparsed: right.unparsed
    }
}

const parseSingleSymbol: Parser<string> =
    satisfy((str: string) => (!(/\s/.test(str)) &&
        !(str >= 'A' && str <= 'Z') &&
        !(str >= 'a' && str <= 'z') &&
        !(str < '0' && str > '9')))

const parseSymbol: Parser<string> =
    span(parseSingleSymbol, arr => arr.join(''), "don't require spaces")

function parseCommand<T>(command: string, fn: (px: AExp) => T): Parser<T> {
    return function(input: string): ParseResult<T> {
        const name = parseName(input);
        if (!name || name.result != command) { return null };

        const num = parseAExp(name.unparsed);
        return map(num, fn);
    };
}

const parseCall: Parser<Exp> = function(input: string): ParseResult<Exp> {
    const name = parseName(input);
    if (name == null || rws.includes(name.result)) { return null; }

    const num = many(parseAExp)(name.unparsed);
    if (num == null) { return null; }

    return {
        unparsed: num.unparsed,
        result: new Call(name.result, num.result)
    }
};


function choice<T>(parsers: Parser<T>[]): Parser<T> {
    return function(input: string) {
        for (let p of parsers) {
            const res = p(input);
            if (res != null) { return res }
        }
        return null;
    }
}

// function or<T>(parserA: Parser<T>, parserB: Parser<T>): Parser<T> {
//     return choice([parserA, parserB]);
// }

const parseFd: Parser<Exp> =
    parseCommand("fd", px => new Forward(px));
const parseRt: Parser<Exp> =
    parseCommand("rt", px => new Rotate(px));
const parseSeth: Parser<Exp> =
    parseCommand("seth", px => new SetHeading(px));

const parseIf: Parser<Exp> = function(input: string): ParseResult<Exp> {
    const name = parseName(input);
    if (name == null || name.result != "if") { return null; }

    const cond = parseBExp(name.unparsed);
    if (cond == null) { return null; }

    const stm = parseExp()(cond.unparsed);
    if (stm == null) { return null; }

    return {
        result: new If(cond.result, stm.result),
        unparsed: stm.unparsed
    }
};

const parseStop: Parser<Exp> = function(input: string) {
    let stop = parseWord(input);
    if (stop == null || stop.result != "stop") { return null }

    return {
        result: new Stop(),
        unparsed: stop.unparsed
    }
}

function brackets<T>(start: string, inner: Parser<T>, end: string): Parser<T> {
    return function(input: string): ParseResult<T> {
        const syml = parseSymbol(input);
        if (syml == null || syml.result != start) { return null; }

        const innerResult = inner(syml.unparsed);
        if (innerResult == null) { return null; }

        const symr = parseSymbol(innerResult.unparsed);
        if (symr == null || symr.result != end) { return null; }

        return {
            result: innerResult.result,
            unparsed: symr.unparsed
        }
    }
}

// function lazyOr(a: Parser<T>, b: () => Parser<T> || Lazy<Parser<T>>)
// parseExp = lazyOr(choice([...]), () => brackets(...))

// TODO: WHY OPTIONAL CHAINING NOT WORK
const parseRepeat: Parser<Exp> = function(input: string): ParseResult<Exp> {
    const repResult: ParseResult<AExp> =
        parseCommand("repeat", num => num)(input);
    if (repResult == null) { return null; }

    const statementResult = parseExps(repResult.unparsed);
    if (statementResult == null) { return null; }

    return {
        unparsed: statementResult.unparsed,
        result: new Repeat(repResult.result, statementResult.result)
    }
}

const parseFn: Parser<Exp> = function(input: string) {
    const toRes = parseName(input);
    if (toRes == null || toRes.result != "to") { return null; }

    const nameRes = parseName(toRes.unparsed);
    if (nameRes == null) { return null; }
    const name = nameRes.result;

    const varRes = many(parseVar)(nameRes.unparsed);
    if (varRes == null) { return null; }
    const vars = varRes.result;

    const expRes = parseExps(varRes.unparsed);
    if (expRes == null) { return null; }
    const exps = expRes.result;

    const endRes = parseWord(expRes.unparsed);
    if (endRes == null || endRes.result != "end") { return null; }

    return {
        unparsed: endRes.unparsed,
        result: new Function(name, vars, exps)
    };
}

const parseExp: () => Parser<Exp> = () => {
    return function(input: string) {
        let termResult = choice([
            parseFd,
            parseRt,
            parseSeth,
            parseRepeat,
            parseFn,
            parseCall,
            parseIf,
            parseStop
        ])(input);

        if (termResult == null) {
            return brackets('[', parseExps, ']')(input);
        } else {
            return termResult
        }
    }
}

const parseExps: Parser<Exp> =
    binaryRight(parseExp(), (a, b) => new Sequence(a, b))

export const parseProgram = parseExps;
