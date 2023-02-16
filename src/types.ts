import { err, ok, type Result } from "neverthrow";
import { RemapError } from "./errors";


enum InternalRemapType {
    Object = "object",
    Key = "key",
    Enum = "enum",
}

export type RemapIssue = {
    path: string[];
    details: string;
}

export class RemapContext {
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
        context.issues = this.issues;
        context.path = [...this.path, key];

        return context;
    }

    public add(details: string) {
        this.issues.add({path: this.path, details});
    }
}


export abstract class Remap<Def> {
    constructor(
        public readonly _def: Def,
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
        super({shape}, InternalRemapType.Object);
    }
    
    public static create<Shape extends RemapObjectMap>(shape: Shape): RemapObject<Shape> {
        return new RemapObject<Shape>(shape);
    }

    /**
     * Map this object to another key.
     * @param to the key to map to.
     * @returns 
     */
    public to<To extends string>(to: To): RemapKey<To, this> {
        return new RemapKey<To, typeof this>(to, this);
    }

    public safeMap<Input extends object>(source: Input): Result<TypeOf<this, Input>, RemapError> {
        const {context, value} = this._map(source, new RemapContext());
        const issues = context.getIssues();
        if (issues.size > 0) return err(RemapError.from(context));

        return ok(value as any);
    }

    public map<T extends object>(source: T): TypeOf<this, T> {
        const {context, value} = this._map(source, new RemapContext());
        
        const issues = context.getIssues();
        if (issues.size > 0) throw RemapError.from(context);

        return value as any;
    }

    protected _map<T extends object>(source: T, context: RemapContext): {context: RemapContext, value: TypeOf<RemapObject<Shape>, T>} {
        const final: any = {};

        if (typeof source !== "object") {
            context.add(`expected object, received ${typeof source}`);
            return {context, value: final};
        }

        for (const [key, value] of Object.entries(source)) {
            if (!Reflect.has(this._def.shape, key)) {
                final[key] = value;
                continue;
            }

            const remap = this._def.shape[key];
            switch (remap.type) {
                case InternalRemapType.Object: {
                    const {value: newValue} = (remap as RemapObject<any>)._map(value, context.at(key));
                    value[key] = newValue;
                    break;
                }

                case InternalRemapType.Key: {
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

                case InternalRemapType.Enum: {
                    final[key] =  (remap as RemapEnum<any, any>).map(value);
                }
            }
        }

        return {
            value: final as any, context
        };
    }
}

export class RemapKey<To extends string, TOutput extends Remap<any> | undefined> extends Remap<{to: To, output: TOutput}> {
    public static create<To extends string>(to: To): RemapKey<string, undefined> {
        return new RemapKey(to);
    }

    constructor(
        to: To,
        output?: TOutput
    ) {
        super({to, output: output ?? undefined as TOutput}, InternalRemapType.Key);
    }

    public get to(): To {
        return this._def.to;
    }

    public get output(): TOutput | undefined {
        return this._def.output;
    }
}

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
        super({from, to}, InternalRemapType.Enum);
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


/**
 * Shortcut to access the `Shape` of a `RemapObject<Shape>`.
 */
type ShapeOf<T extends RemapObject<any>> = T["_def"]["shape"];
type GetIndex<T extends object, V> = {[P in keyof T]: T[P] extends V ? P : never }[keyof T]; // there may be a more efficient type, but this works for now.
/**
 * Returns source index of a given `RemapKey<P, any>`.
 */
type _Index<T extends RemapObject<any>, P extends string | symbol | number> = GetIndex<ShapeOf<T>, RemapKey<P & string, any>>;
/**
 * Omits all properties whose type is never for a cleaner end type.
 */
type OmitNever<T> = { [K in keyof T as T[K] extends never ? never : K]: T[K] }
type CopyUnknown<T extends RemapObject<any>, Input extends object> = {
    [P in Exclude<keyof Input, keyof ShapeOf<T>>]: Input[P];
}
type RemapObjects<T extends RemapObject<any>, Input extends object> = {
    [P in Exclude<keyof ShapeOf<T>, keyof CopyUnknown<T, Input>>]: ShapeOf<T>[P] extends RemapObject<infer S> ? TypeOf<RemapObject<S>, Input[P] & object> : never;
}

type RemapKeys<T extends RemapObject<any>, Input extends object> = {
    [P in (ShapeOf<T>[keyof ShapeOf<T>] extends RemapKey<infer U, any> ? U : never)]: _Index<T, P> extends keyof Input ? // check if source index exists on input, otherwise don't evaluate it
        ShapeOf<T>[_Index<T, P>] extends RemapKey<P, infer O> ? 
            O extends Remap<any> ?
                O extends RemapObject<infer S> ? TypeOf<RemapObject<S>, Input[_Index<T, P>] & object> : never
            : Input[_Index<T, P>]
        : never
    : never;
}

type TypeOf<T extends RemapObject<any>, Input extends object> = OmitNever<
    CopyUnknown<T, Input> & 
    RemapObjects<T, Input> &
    RemapKeys<T, Input>
>;



/**
 * Remap an object. This is also the root of a remap schema.
 */
const rObject = <TShape extends RemapObjectMap>(shape: TShape) =>  RemapObject.create<TShape>(shape);
/**
 * Remap whatever is at this key to the new key.
 * @param to the key to map to.
 */
const rTo = <To extends string>(to: To): RemapKey<To, undefined> => RemapKey.create<To>(to) as RemapKey<To, undefined>;
/**
 * Remap enums. Specified enum arrays need to be of the same size.
 */
const rEnum = <T extends string | number, From extends readonly [T, ...T[]], U extends string, To extends readonly [U, ...U[]]>(from: From, to: To) => RemapEnum.create<From, To>(from, to);


export {
    rObject as object,
    rTo as to,
    rEnum as enum,
}
export { type TypeOf as infer };