import { Pet as PetModel } from "@pawlog/database";
import { AsCreateRequest, AsUpdateRequest } from "../";

export type Pet = PetModel;
export type PetCreateInput = AsCreateRequest<Pet>;
export type PetUpdateInput = AsUpdateRequest<Pet>;
