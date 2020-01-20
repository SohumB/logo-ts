import { Exp, Forward, Rotate, SetHeading, Sequence } from './ast';

interface KnownParseResult<T> {
    unparsed: string,
    result: T
}


type Lazy<T> = () => T;
type ParseResult<T> = null | KnownParseResult<T>;

function suspend<T>(ft: () => T) { return ft };

function force<T>(l: Lazy<T>): T {
    return l();
}

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

// const parseSpaces: Parser<null> =
//     function(input: string): ParseResult<null> {
//         return map(many(parseSpace)(input), _ => null);
//     }

// does not succeed if no spaces
function lexeme<T>(
    parser: Parser<T>,
    requireSpace: boolean = true): Parser<T> {
    return function(input: string): ParseResult<T> {
        let afterParser = parser(input);
        if (afterParser == null) { return null };
        let spaceConsumer = many(parseSpace);
        if (requireSpace) {
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

function satisfy(fn: (str: string) => boolean): Parser<string> {
    return function(input: string): ParseResult<string> {
        if (fn(input[0])) {
            return {
                unparsed: input.slice(1),
                result: input[0]
            }
        }
        return null;
    }
}

function span<T, U>(
    parser: Parser<T>,
    fn: (ts: T[]) => U,
    requireSpace: boolean): Parser<U> {
    return lexeme(function(input) {
        let sts = failOnEmpty(many(parser))(input);
        return map(sts, arr => fn(arr));
    }, requireSpace)
}

const parseDigit: Parser<string> =
    satisfy((str: string) => str >= '0' && str <= '9');

const parseNumber: Parser<number> =
    span(parseDigit, arr => parseInt(arr.join('')), false);

const parseAlpha: Parser<string> =
    satisfy((str: string) => str >= 'A' && str <= 'z');

const parseWord: Parser<string> =
    span(parseAlpha, arr => arr.join(''), false);

const parseName: Parser<string> =
    span(parseAlpha, arr => arr.join(''), true);

function parseCommand(command: string, fn: (px: number) => Exp): Parser<Exp> {
    return function(input: string): ParseResult<Exp> {
        const name = parseName(input);
        if (!name || name.result != command) { return null };
        const pixels = parseNumber(name.unparsed);
        return map(pixels, fn);
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

function lazyChoice<T>(parsers: Lazy<Parser<T>>[]): Parser<T> {
    return function(input: string) {
        for (let p of parsers) {
            const res = (force(p))(input);
            if (res != null) { return res }
        }
        return null;
    }
}

function parseSeq<T, U, V>(
    pt: Parser<T>,
    pu: Parser<U>,
    combine: (t: T, u: U) => V
): Parser<V> {
    return function(input): ParseResult<V> {
        let resT = pt(input);
        if (!resT) { return null; }
        let resU = pu(resT.unparsed);
        if (!resU) { return null; }
        return {
            unparsed: resU.unparsed,
            result: combine(resT.result, resU.result)
        }
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

// fd 20 rt 120
// pE: [fd 20]... FAIL because not at eof
// pS: [fd 20] (succeed, don't care) [rt 120] (sdc) (succeed, at EOF)

function atEof<T>(p: Parser<T>): Parser<T> {
    return function(input) {
        const res = p(input);
        if (!res || res.unparsed != '') { return null; }
        return res;
    }
}

function recursiveParser<T>(
    baseParser: Parser<T>,
    stepParser: (pa: Parser<T>, pb: Parser<T>) => Parser<T>,
    atTopLevel: boolean = true
): Parser<T> {
    return lazyChoice([
        suspend(() =>
            atTopLevel ?
                atEof(baseParser) :
                baseParser),
        suspend(() => {
            let r = recursiveParser(baseParser, stepParser, false)
            return atTopLevel ?
                atEof(stepParser(r, r)) :
                stepParser(r, r)
        })
    ]);
}

const parseExp = choice([
    parseFd,
    parseRt,
    parseSeth
]);

const parseExps = recursiveParser(
    parseExp,
    (pa: Parser<Exp>, pb: Parser<Exp>) =>
        parseSeq(pa, pb, (a, b) => new Sequence(a, b))
)

export const parseProgram = parseExps;
