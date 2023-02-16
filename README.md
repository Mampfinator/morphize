# Morphize

A (work in progress) [Zod](https://github.com/colinhacks/zod)-inspired object transform & remapping library with static type inference.

## Usage

```ts
import { m } from "morphize";

const schema = m.object({
    example: m.object({
        foo: m.to("bar"),
        test_status: m.enum([0, 1, 2], ["Success", "Pending", "Failed"]).to("testStatus")
    }).to("somewhereElse"),
});

const example = schema.map({
    example: {
        foo: "c:",
        test_status: 0,
    }
});

// returns: 
//{
//    somewhereElse: {
//        bar: "c:",
//        testStatus: "Success"
//    }
//}
```

For type inference, simply use `m.infer<TSchema, TInput>`:

```ts
import { m } from "morphize";

const TestSchema = m.object({
    test: m.to("tested"),
});

type Input = {
    test: string,
    unaffected: boolean
}

type Test = m.infer<typeof TestSchema, Input>; // { tested: string, unaffected: boolean }
```
