# Remap

A (work in progress) [Zod](https://github.com/colinhacks/zod)-inspired object remapping library with static type inference.

## Usage

```ts
import { r } from "remap";

const schema = r.object({
    example: r.object({
        foo: r.to("bar"),
        test_status: r.enum([0, 1, 2], ["Success", "Pending", "Failed"]).to("testStatus")
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

For type inference, simply use `r.infer<TSchema, TInput>`:

```ts
import { r } from "remap";

const TestSchema = r.object({
    test: r.to("tested"),
});

type Input = {
    test: string,
    unaffected: boolean
}

type Test = r.infer<typeof TestSchema, Input>; // { tested: string, unaffected: boolean }
```
