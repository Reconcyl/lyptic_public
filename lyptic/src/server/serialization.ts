/*interface ISerializer<TData> {
    serialize(data: TData, target: Uint8Array, pointer: number): number;
    deserialize(target: Uint8Array, pointer: number): [TData, number];
}

class StructSerializer<TData> implements ISerializer<TData> {
    constructor(private readonly fields: { key: keyof TData, serializer: ISerializer<any> }[]) {
    }

    deserialize(target: Uint8Array, pointer: number): [TData, number] {
        return [undefined, 0];
    }

    serialize(data: TData, target: Uint8Array, pointer: number): number {
        return 0;
    }

}

const schema_player_pos = new SerializerDelegator();*/