import { err, ok, type Result } from "neverthrow";
import { MorphError } from "./errors";


enum InternalMorphType {
    Object = "object",
    Key = "key",
    Enum = "enum",
}

export type MorphIssue = {
    path: string[];
    details: string;
}

export class MorphContext {
    protected issues: Set<MorphIssue> = new Set();
    protected path: string[] = [];

    public get isRoot(): boolean {
        return this.path.length == 0;
    }

    public getIssues(): Set<MorphIssue> {
        return new Set(this.issues);
    }

    public getPath(): string[] {
        return [...this.path];
    }

    public at(key: string): MorphContext {
        const context = new MorphContext();
        context.issues = this.issues;
        context.path = [...this.path, key];

        return context;
    }

    public add(details: string) {
        this.issues.add({path: this.path, details});
    }
}


export abstract class Morpher<Def> {
    constructor(
        public readonly _def: Def,
        public readonly type: string,
    ) {}
}

type MorphObjectMap = {
    [key: string]: Morpher<any>;
}
export class MorphObject<Shape extends MorphObjectMap> extends Morpher<{shape: Shape}> {
    constructor(
        shape: Shape
    ) {
        super({shape}, InternalMorphType.Object);
    }
    
    public static create<Shape extends MorphObjectMap>(shape: Shape): MorphObject<Shape> {
        return new MorphObject<Shape>(shape);
    }

    /**
     * Map this object to another key.
     * @param to the key to map to.
     * @returns 
     */
    public to<To extends string>(to: To): MorphKey<To, this> {
        return new MorphKey<To, typeof this>(to, this);
    }

    public safeMap<Input extends object>(source: Input): Result<TypeOf<this, Input>, MorphError> {
        const {context, value} = this._map(source, new MorphContext());
        const issues = context.getIssues();
        if (issues.size > 0) return err(MorphError.from(context));

        return ok(value as any);
    }

    public map<T extends object>(source: T): TypeOf<this, T> {
        const {context, value} = this._map(source, new MorphContext());
        
        const issues = context.getIssues();
        if (issues.size > 0) throw MorphError.from(context);

        return value as any;
    }

    protected _map<T extends object>(source: T, context: MorphContext): {context: MorphContext, value: TypeOf<MorphObject<Shape>, T>} {
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
                case InternalMorphType.Object: {
                    const {value: newValue} = (remap as MorphObject<any>)._map(value, context.at(key));
                    value[key] = newValue;
                    break;
                }

                case InternalMorphType.Key: {
                    const newKey = (remap as MorphKey<string, any>).to;
                    const output = (remap as MorphKey<string, any>).output;
                    
                    // there has to be a better way of doing this. But it's fine for now.
                    const newValue = output instanceof Morpher ? (
                        output instanceof MorphObject ? output._map(value, context.at(key)).value :
                        output instanceof MorphEnum ? output.map(value) : (() => {throw new Error(`Internal error! Unexpected Morph type at ${context.at(key).getPath().join(".")}`)})()
                    ) : value; 

                    final[newKey] = newValue;
                    break;
                }

                case InternalMorphType.Enum: {
                    final[key] =  (remap as MorphEnum<any, any>).map(value);
                }
            }
        }

        return {
            value: final as any, context
        };
    }
}

export class MorphKey<To extends string, TOutput extends Morpher<any> | undefined> extends Morpher<{to: To, output: TOutput}> {
    public static create<To extends string>(to: To): MorphKey<string, undefined> {
        return new MorphKey(to);
    }

    constructor(
        to: To,
        output?: TOutput
    ) {
        super({to, output: output ?? undefined as TOutput}, InternalMorphType.Key);
    }

    public get to(): To {
        return this._def.to;
    }

    public get output(): TOutput | undefined {
        return this._def.output;
    }
}

export class MorphEnum<
    Input extends readonly [string | number, ...(string | number)[]], 
    Output extends readonly [string, ...string[]]
> extends Morpher<{from: Input, to: Output}> {
    public static create<
        Input extends readonly [string | number, ...(string | number)[]], 
        Output extends readonly [string, ...string[]]
    >(from: Input, to: Output): MorphEnum<Input, Output> {
        return new MorphEnum<Input, Output>(from, to);
    }

    constructor(
        from: Input,
        to: Output
    ) {
        super({from, to}, InternalMorphType.Enum);
    }

    /**
     * Morph this enum to another key.
     * @param to the key to map to.
     * @returns 
     */
    public to<To extends string>(to: To): MorphKey<To, this> {
        return new MorphKey(to, this);
    }

    public map(input: any): any {
        return this._def.to[this._def.from.indexOf(input as any)]! as any;
    }

}


/**
 * Shortcut to access the `Shape` of a `MorphObject<Shape>`.
 */
type ShapeOf<T extends MorphObject<any>> = T["_def"]["shape"];
type GetIndex<T extends object, V> = {[P in keyof T]: T[P] extends V ? P : never }[keyof T]; // there may be a more efficient type, but this works for now.
/**
 * Returns source index of a given `MorphKey<P, any>`.
 */
type _Index<T extends MorphObject<any>, P extends string | symbol | number> = GetIndex<ShapeOf<T>, MorphKey<P & string, any>>;
/**
 * Omits all properties whose type is never for a cleaner end type.
 */
type OmitNever<T> = { [K in keyof T as T[K] extends never ? never : K]: T[K] }
type CopyUnknown<T extends MorphObject<any>, Input extends object> = {
    [P in Exclude<keyof Input, keyof ShapeOf<T>>]: Input[P];
}
type MorphObjects<T extends MorphObject<any>, Input extends object> = {
    [P in Exclude<keyof ShapeOf<T>, keyof CopyUnknown<T, Input>>]: ShapeOf<T>[P] extends MorphObject<infer S> ? TypeOf<MorphObject<S>, Input[P] & object> : never;
}

type MorphKeys<T extends MorphObject<any>, Input extends object> = {
    [P in (ShapeOf<T>[keyof ShapeOf<T>] extends MorphKey<infer U, any> ? U : never)]: _Index<T, P> extends keyof Input ? // check if source index exists on input, otherwise don't evaluate it
        ShapeOf<T>[_Index<T, P>] extends MorphKey<P, infer O> ? 
            O extends Morpher<any> ?
                O extends MorphObject<infer S> ? TypeOf<MorphObject<S>, Input[_Index<T, P>] & object> : never
            : Input[_Index<T, P>]
        : never
    : never;
}

type TypeOf<T extends MorphObject<any>, Input extends object> = OmitNever<
    CopyUnknown<T, Input> & 
    MorphObjects<T, Input> &
    MorphKeys<T, Input>
>;



/**
 * Morph an object. This is also the root of a remap schema.
 */
const rObject = <TShape extends MorphObjectMap>(shape: TShape) =>  MorphObject.create<TShape>(shape);
/**
 * Morph whatever is at this key to the new key.
 * @param to the key to map to.
 */
const rTo = <To extends string>(to: To): MorphKey<To, undefined> => MorphKey.create<To>(to) as MorphKey<To, undefined>;
/**
 * Morph enums. Specified enum arrays need to be of the same size.
 */
const rEnum = <T extends string | number, From extends readonly [T, ...T[]], U extends string, To extends readonly [U, ...U[]]>(from: From, to: To) => MorphEnum.create<From, To>(from, to);


export {
    rObject as object,
    rTo as to,
    rEnum as enum,
}
export { type TypeOf as infer };