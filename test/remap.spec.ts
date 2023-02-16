import { expect } from "chai";
import { expectType } from "tsd";
import { r } from "../src";

describe("Remap Tests", () => {
    it("remaps simple objects", () => {
        const schema = r.object({
            test: r.to("tested")
        });

        const test = schema.map({ test: ":)" });
        const control = { tested: ":)" }

        expectType<typeof control>(test);
        expect(test).deep.equal(control);
    });

    it("remaps nested objects", () => {
        const schema = r.object({
            test: r.object({
                foo: r.to("bar"),
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
        const schema = r.object({});
        
        const test = schema.map({tested: "Indeed!"})
        const control = {tested: "Indeed!"};

        expectType<typeof control>(test);
        expect(test).deep.equal(control);
    });

    it("remaps enums", () => {
        const from = [0, 1, 2] as const;
        const to = ["Tested", "Pending", "Failed"] as const;

        const remap1 = r.enum(from, to);
        expect(remap1.map(1)).to.equal("Pending");

        const remap2 = r.object({
            test: r.enum(from, to).to("tested")
        });
        
        expect(remap2.map({
            test: 1
        })).deep.equal({
            tested: "Pending"
        });

    });

    it("lists issues", () => {
        const schema = r.object({
            test: r.object({}).to("tested")
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
});