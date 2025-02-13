import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class InputTokenModel {
    @Field()
    tokenID: string;
    @Field(() => Int)
    nonce: number;
    @Field()
    amount: string;
    @Field({ nullable: true })
    attributes?: string;

    constructor(init?: Partial<InputTokenModel>) {
        Object.assign(this, init);
    }
}
