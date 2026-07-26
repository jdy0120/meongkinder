import type { Pet } from "@pawlog/database";

export interface CreatePetRequest {
  name: string;
  species: string; // 종 (예: DOG, CAT)
  breed?: string;
  birthDate?: string; // ISO 8601
  gender?: string; // MALE | FEMALE
  isNeutered?: boolean;
  weightKg?: number;
  profileImageFileId?: string;
  memo?: string;
}

export type UpdatePetRequest = Partial<CreatePetRequest>;

export interface PetResponse {
  pet: Pet;
}
