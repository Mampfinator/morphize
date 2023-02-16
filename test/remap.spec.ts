import { expect } from "chai";
import { expectType } from "tsd";
import { m } from "../src";

describe("Morph Tests", () => {
    it("remaps simple objects", () => {
        const schema = m.object({
            test: m.to("tested")
        });

        const test = schema.map({ test: ":)" });
        const control = { tested: ":)" }

        expectType<typeof control>(test);
        expect(test).deep.equal(control);
    });

    it("remaps nested objects", () => {
        const schema = m.object({
            test: m.object({
                foo: m.to("bar"),
            }).to("tested")
        });
        const test = schema.map({test: {foo: "c:"}});
        const control = {
            tested: {
                bar: "c:"
            }
        }

        expectType<typeof control>(test);

        expect(test).deep.equal(control);
    });

    it("keeps unknown properties", () => {
        const schema = m.object({});
        
        const test = schema.map({tested: "Indeed!"})
        const control = {tested: "Indeed!"};

        expectType<typeof control>(test);
        expect(test).deep.equal(control);
    });

    it("remaps enums", () => {
        const from = [0, 1, 2] as const;
        const to = ["Tested", "Pending", "Failed"] as const;

        const remap1 = m.enum(from, to);
        expect(remap1.map(1)).to.equal("Pending");

        const remap2 = m.object({
            test: m.enum(from, to).to("tested")
        });
        
        expect(remap2.map({
            test: 1
        })).deep.equal({
            tested: "Pending"
        });

    });

    it("lists issues", () => {
        const schema = m.object({
            test: m.object({}).to("tested")
        });

        const result = schema.safeMap({test: ":)"});

        if (result.isOk()) {
            throw new Error("Unexpected Ok!");
        }

        expect(result.error.issues).to.deep.equal([
            {
                path: ["test"],
                details: "expected object, received string"
            }
        ]);
    });

    it("transforms values", () => {
        const schema = m.object({
            date: m.transform((input: string) => new Date(input)),
        });

        const test = schema.map({date: "0"});
        const control = {date: new Date("0")};

        expectType<typeof control>(test);
        expect(test).to.deep.equal(control);
    });

    it ("transforms values in remapped keys", () => {
        const schema = m.object({
            started_at: m.transform((input: number) => new Date(input)).to("startedAt")
        });
        const test = schema.map({started_at: 0});
        const control = {startedAt: new Date(0)};

        expectType<typeof control>(test); 
        expect(test).to.deep.equal(control)

    })
});