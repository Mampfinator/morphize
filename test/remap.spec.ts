import { expect } from "chai";
import { r } from "../src";

describe("Remap Tests", () => {
    it("remaps simple objects", () => {
        const test = r.object({
            test: r.to("tested")
        });

        expect(test.map({test: ":)"})).deep.equal({tested: ":)"});
    });

    it("remaps nested objects", () => {
        const remap = r.object({
            test: r.object({
                foo: r.to("bar"),
            }).to("tested")
        });

        expect(remap.map({test: {foo: "c:"}})).deep.equal({
            tested: {
                bar: "c:"
            }
        });
    });

    it("keeps unknown properties", () => {
        const remap = r.object({});
        expect(remap.map({tested: "Indeed!"})).deep.equal({tested: "Indeed!"});
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
});