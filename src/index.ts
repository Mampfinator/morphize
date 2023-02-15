import { err, ok, type Result } from "neverthrow";
import { RemapError } from "./errors";


enum RemapType {
    Object = "object",
    Key = "key",
    Enum = "enum",
}

type RemapIssue = {
    path: string[];
    details: string;
}

class RemapContext {
    protected issues: Set<RemapIssue> = new Set();
    protected path: string[] = [];

    public get isRoot(): boolean {
        return this.path.length == 0;
    }

    public getIssues(): Set<RemapIssue> {
        return new Set(this.issues);
    }

    public getPath(): string[] {
        return [...this.path];
    }

    public at(key: string): RemapContext {
        const context = new RemapContext();
        context.issues = new Set(this.issues);
        context.path = [...this.path, key];

        return context;
    }

    public add(details: string) {
        this.issues.add({path: this.path, details});
    }
}


abstract class Remap<Def> {
    constructor(
        protected readonly _def: Def,
        public readonly type: string,
    ) {}
}

type RemapObjectMap = {
    [key: string]: Remap<any>;
}
export class RemapObject<Shape extends RemapObjectMap> extends Remap<{shape: Shape}> {
    constructor(
        shape: Shape
    ) {
        super({shape}, RemapType.Object);
    }
    
    public static create<Shape extends RemapObjectMap>(shape: Shape): RemapObject<Shape> {
        return new RemapObject(shape);
    }

    /**
     * Map this object to another key.
     * @param to the key to map to.
     * @returns 
     */
    public to<To extends string>(to: To): RemapKey<To, this> {
        return new RemapKey<To, typeof this>(to, this);
    }

    public safeMap<T extends object>(source: T): Result<RemapInfer<this, T>, RemapError> {
        const {context, value} = this._map(source, new RemapContext());
        const issues = context.getIssues();
        if (issues.size > 0) return err(new RemapError());

        return ok(value);
    }

    public map<T extends object>(source: T): RemapInfer<this, T> {
        if (typeof source !== "object") throw new TypeError(`Expected source to be object, got ${typeof source} instead.`);
        const {context, value} = this._map(source, new RemapContext());
        
        const issues = context.getIssues();
        if (issues.size > 0) throw new RemapError();

        return value;
    }

    protected _map<T extends object>(source: T, context: RemapContext): {context: RemapContext, value: RemapInfer<RemapObject<Shape>, T>} {
        const final: Partial<RemapInfer<typeof this, T>> = {};

        if (typeof source !== "object") {
            context.add(`expected object, received ${typeof source}`);
        }

        for (const [key, value] of Object.entries(source)) {
            if (!Reflect.has(this._def.shape, key)) {
                final[key] = value;
                continue;
            }

            const remap = this._def.shape[key];
            switch (remap.type) {
                case RemapType.Object: {
                    const {value: newValue} = (remap as RemapObject<any>)._map(value, context.at(key));
                    value[key] = newValue;
                    break;
                }

                case RemapType.Key: {
                    const newKey = (remap as RemapKey<string, any>).to;
                    const output = (remap as RemapKey<string, any>).output;
                    
                    // there has to be a better way of doing this. But it's fine for now.
                    const newValue = output instanceof Remap ? (
                        output instanceof RemapObject ? output._map(value, context.at(key)).value :
                        output instanceof RemapEnum ? output.map(value) : (() => {throw new Error(`Internal error! Unexpected Remap type at ${context.at(key).getPath().join(".")}`)})()
                    ) : value; 

                    final[newKey] = newValue;
                    break;
                }

                case RemapType.Enum: {
                    final[key] =  (remap as RemapEnum<any, any>).map(value);
                }
            }
        }

        return {
            value: final, context
        };
    }
}

export class RemapKey<To extends string, TOutput extends Remap<any>> extends Remap<{to: To, output: TOutput}> {
    public static create<To extends string>(to: To): RemapKey<string, never> {
        return new RemapKey(to);
    }

    constructor(
        to: To,
        output?: TOutput
    ) {
        super({to, output: output ?? undefined as never}, RemapType.Key);
    }

    public get to(): To {
        return this._def.to;
    }

    public get output(): TOutput | undefined {
        return this._def.output;
    }
}

type ArrayElement<TArray extends readonly unknown[]> = TArray extends Array<infer T> ? T : never;

export class RemapEnum<
    Input extends readonly [string | number, ...(string | number)[]], 
    Output extends readonly [string, ...string[]]
> extends Remap<{from: Input, to: Output}> {
    public static create<
        Input extends readonly [string | number, ...(string | number)[]], 
        Output extends readonly [string, ...string[]]
    >(from: Input, to: Output): RemapEnum<Input, Output> {
        return new RemapEnum<Input, Output>(from, to);
    }

    constructor(
        from: Input,
        to: Output
    ) {
        super({from, to}, RemapType.Enum);
    }

    /**
     * Remap this enum to another key.
     * @param to the key to map to.
     * @returns 
     */
    public to<To extends string>(to: To): RemapKey<To, this> {
        return new RemapKey(to, this);
    }

    public map(input: any): any {
        return this._def.to[this._def.from.indexOf(input as any)]! as any;
    }

}



// **massive** TODO
type RemapInfer<T extends RemapObject<any>, Source extends object> = Record<any, any>;







/**
 * Remap an object. This is also the root of a remap schema.
 */
const rObject = <TShape extends RemapObjectMap>(shape: TShape) =>  RemapObject.create<TShape>(shape);
/**
 * Remap whatever is at this key to the new key.
 * @param to the key to map to.
 */
const rTo = <To extends string>(to: To): RemapKey<To, never> => RemapKey.create<To>(to) as RemapKey<To, never>;
/**
 * Remap enums. Specified enum arrays need to be of the same size.
 */
const rEnum = <T extends string | number, From extends readonly [T, ...T[]], U extends string, To extends readonly [U, ...U[]]>(from: From, to: To) => RemapEnum.create<From, To>(from, to);


export {
    rObject as object,
    rTo as to,
    rEnum as enum,
}

export const r = {
    object: rObject,
    to: rTo,
    enum: rEnum,
}